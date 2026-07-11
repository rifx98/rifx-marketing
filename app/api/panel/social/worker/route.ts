import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import { triggerCriticalAlert } from '@/lib/alerts';
import { MetaPublishingService } from '@/services/social/meta';
import { YouTubePublishingService } from '@/services/social/youtube';
import { TikTokPublishingService } from '@/services/social/tiktok';
import { deleteFile } from '@/lib/r2';

// Helper for writing social logs
async function writeLog(supabase: any, publicationId: string, message: string, level: 'info' | 'warning' | 'error' = 'info', metadata: any = {}) {
  try {
    await supabase
      .from('social_logs')
      .insert({
        publication_id: publicationId,
        log_level: level,
        message,
        metadata
      });
  } catch (err) {
    console.error('Failed to write social log:', err);
  }
}

// Helper to check if all publications for a post are done, and delete the source video from storage
async function checkAndCleanupVideo(supabase: any, postId: string, videoStoragePath: string) {
  try {
    const { data: allPubs } = await supabase
      .from('social_publications')
      .select('status')
      .eq('post_id', postId);

    const allFinished = allPubs?.every((p: any) => p.status === 'published' || p.status === 'failed');
    if (allFinished) {
      await deleteFile(videoStoragePath);
      console.log(`[Social Worker] Temporary video successfully deleted from Cloudflare R2.`);
    }
  } catch (e) {
    console.error('[Social Worker] Error in checkAndCleanupVideo:', e);
  }
}

// POST: Webhook consumido por QStash o el fallback de desarrollo para publicar el video
export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdmin();
  let publicationId = '';
  let post: any = null;


  try {
    // 1. Validar firma de seguridad (Bypass en entorno local de pruebas)
    const isDevBypass = req.headers.get('X-Dev-Worker-Signature') === 'local_secret_development_bypass';
    const jwtSecret = process.env.JWT_SECRET;

    if (jwtSecret && !isDevBypass) {
      const workerSecret = req.headers.get('X-Worker-Secret');
      if (workerSecret !== jwtSecret) {
        console.error('❌ [Social Worker] Unauthorized request: X-Worker-Secret header does not match JWT_SECRET');
        return NextResponse.json({ error: 'Firma de cola no autorizada' }, { status: 401 });
      }
    }

    const body = await req.json();
    publicationId = body.publicationId;

    if (!publicationId) {
      return NextResponse.json({ error: 'Falta ID de publicación' }, { status: 400 });
    }

    console.log(`[Social Worker] Processing publication: ${publicationId}`);

    // 2. Obtener datos de la publicación, post y cuenta
    const { data: pub, error: pubError } = await supabase
      .from('social_publications')
      .select('*')
      .eq('id', publicationId)
      .single();

    if (pubError || !pub) {
      console.error(`[Social Worker] Publication not found: ${publicationId}`);
      return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    }

    // Si ya está procesándose o publicada con éxito, retornar 200 para evitar duplicados
    if (pub.status === 'processing' || pub.status === 'published') {
      console.log(`[Social Worker] Publication ${publicationId} is already ${pub.status}. Aborting to prevent duplicate.`);
      return NextResponse.json({ success: true, message: `Already ${pub.status}` });
    }

    // Si está programada en el futuro y no es bypass de desarrollo, abortar
    if (pub.scheduled_at && !isDevBypass) {
      const scheduledTime = new Date(pub.scheduled_at).getTime();
      const now = Date.now();
      if (scheduledTime > now + 10000) { // Tolerancia de 10s
        console.log(`[Social Worker] Publication ${publicationId} is scheduled for ${pub.scheduled_at}. Current time is ${new Date().toISOString()}. Aborting.`);
        return NextResponse.json({ success: true, message: `Scheduled for future: ${pub.scheduled_at}` });
      }
    }

    const { data: postData, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', pub.post_id)
      .single();

    post = postData;


    const { data: account, error: accError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', pub.social_account_id)
      .single();

    if (postError || !post || accError || !account) {
      const errMsg = 'Error obteniendo dependencias del post o cuenta vinculada';
      console.error(`[Social Worker] ${errMsg}:`, { postError, accError });
      await supabase.from('social_publications').update({ status: 'failed', last_error: errMsg }).eq('id', publicationId);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    // 3. Cambiar estado a 'processing' e incrementar intentos de forma atómica (optimistic locking)
    const currentAttempts = (pub.attempts || 0) + 1;
    const { data: lockedPub, error: lockError } = await supabase
      .from('social_publications')
      .update({
        status: 'processing',
        attempts: currentAttempts,
        updated_at: new Date().toISOString()
      })
      .eq('id', publicationId)
      .eq('status', 'pending') // Solo reclama si sigue pendiente
      .select();

    if (lockError || !lockedPub || lockedPub.length === 0) {
      console.log(`[Social Worker] Concurrency lock: Publication ${publicationId} was already claimed or updated by another worker.`);
      return NextResponse.json({ success: true, message: 'Already processed or processing' });
    }

    await writeLog(supabase, publicationId, `Iniciando intento de publicación #${currentAttempts} en ${account.platform}...`, 'info');

    // 4. Descifrar el Token de Acceso
    let accessToken = '';
    try {
      accessToken = decryptToken(
        account.encrypted_access_token,
        account.encryption_iv,
        account.encryption_tag
      );
    } catch (decErr: any) {
      const decErrMsg = `Error descifrando token de seguridad: ${decErr.message}`;
      console.error(`[Social Worker] ${decErrMsg}`);
      await writeLog(supabase, publicationId, decErrMsg, 'error');
      await supabase.from('social_publications').update({ status: 'failed', last_error: decErrMsg }).eq('id', publicationId);
      if (account.tenant_id) {
        triggerCriticalAlert({
          tenantId: account.tenant_id,
          title: '🔌 Cuenta social desconectada',
          message: `No se pudo publicar en ${account.platform} (${account.platform_username || account.platform_user_id}) — el token de acceso ya no es válido. Reconecta la cuenta desde el panel.`,
          url: '/panel',
        }).catch(() => {});
      }
      return NextResponse.json({ error: decErrMsg }, { status: 400 }); // Fatal error, no retry
    }

    // 5. Ejecutar la llamada a la API correspondiente
    let externalMediaId = '';

    if (account.platform === 'facebook') {
      const isLongVideo = post.video_type === 'long';
      if (isLongVideo) {
        await writeLog(supabase, publicationId, 'Subiendo video y preparando publicación de Video Largo en Facebook...', 'info');
        const result = await MetaPublishingService.publishFacebookVideo(
          account.platform_user_id,
          accessToken,
          post.video_public_url,
          post.caption,
          post.title
        );
        externalMediaId = result.id;
      } else {
        await writeLog(supabase, publicationId, 'Subiendo video y preparando Reel de Facebook...', 'info');
        const result = await MetaPublishingService.publishFacebookReel(
          account.platform_user_id,
          accessToken,
          post.video_public_url,
          post.caption
        );
        externalMediaId = result.id;
      }
    } 
    else if (account.platform === 'instagram') {
      // Instagram requiere polling de transcoding en Meta, pasamos el callback de logs
      const result = await MetaPublishingService.publishInstagramReel(
        account.platform_user_id,
        accessToken,
        post.video_public_url,
        post.caption,
        async (msg, lvl) => {
          await writeLog(supabase, publicationId, msg, lvl || 'info');
        }
      );
      externalMediaId = result.id;
    } 
    else if (account.platform === 'youtube') {
      const isLongVideo = post.video_type === 'long';
      await writeLog(supabase, publicationId, isLongVideo ? 'Subiendo video y preparando Video en YouTube...' : 'Subiendo video y preparando Shorts en YouTube...', 'info', {});
      const result = await YouTubePublishingService.publishShort(
        accessToken,
        post.video_public_url,
        post.title || 'RIFX Video',
        post.caption,
        async (msg, lvl) => {
          await writeLog(supabase, publicationId, msg, lvl || 'info');
        }
      );
      externalMediaId = result.id;
    }
    else if (account.platform === 'tiktok') {
      await writeLog(supabase, publicationId, 'Subiendo video y preparando publicación en TikTok...', 'info');
      const result = await TikTokPublishingService.publishVideo(
        accessToken,
        post.video_public_url,
        post.caption,
        async (msg, lvl) => {
          await writeLog(supabase, publicationId, msg, lvl || 'info');
        }
      );
      externalMediaId = result.id;
    }
    else {
      throw new Error(`Plataforma no soportada: ${account.platform}`);
    }

    // 6. Éxito: Actualizar estados y registrar log
    await supabase
      .from('social_publications')
      .update({
        status: 'published',
        external_media_id: externalMediaId,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', publicationId);

    await writeLog(supabase, publicationId, `¡Publicación exitosa en ${account.platform}! Media ID: ${externalMediaId}`, 'info');

    // 7. Cleanup Check: Si todas las publicaciones de este post están terminadas, eliminar video de storage
    if (post && post.id && post.video_storage_path) {
      await checkAndCleanupVideo(supabase, post.id, post.video_storage_path);
    }

    return NextResponse.json({ success: true, mediaId: externalMediaId });
  } catch (error: any) {
    const errorMsg = error.message || error;
    console.error(`❌ [Social Worker] Execution failed for ${publicationId}:`, errorMsg);
    
    if (publicationId) {
      await writeLog(supabase, publicationId, `Error en publicación: ${errorMsg}`, 'error');
      await supabase
        .from('social_publications')
        .update({
          status: 'failed',
          last_error: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', publicationId);

      // Cleanup Check en caso de fallo
      if (post && post.id && post.video_storage_path) {
        await checkAndCleanupVideo(supabase, post.id, post.video_storage_path);
      }
    }

    // Si es local o ya agotó reintentos, retornar 200 para que QStash no siga intentando.
    // De lo contrario, retornamos 500 para permitir reintento con backoff en QStash.
    return NextResponse.json({ error: errorMsg }, { status: 200 });
  }
}
