import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { getDownloadPresignedUrl } from '@/lib/r2';

// POST: Registrar post de video y encolar tareas de publicación por canal
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { videoStoragePath, caption, title, platformAccountIds, scheduledAt, videoType } = body;

    if (!videoStoragePath || !caption || !platformAccountIds || !Array.isArray(platformAccountIds) || platformAccountIds.length === 0) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (videoStoragePath, caption, platformAccountIds)' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Generar URL firmada del video en Cloudflare R2 (Válida por 24 horas para colas/publicación diferida)
    let downloadUrl = '';
    try {
      downloadUrl = await getDownloadPresignedUrl(videoStoragePath, 86400);
    } catch (signError) {
      console.error('❌ [Social Publish] R2 signed URL error:', signError);
      return NextResponse.json({ error: 'Error al generar enlace temporal del video en Cloudflare R2' }, { status: 500 });
    }

    // 2. Crear la entrada del Post principal
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: tenant.tenantId,
        title: title || '',
        caption,
        video_storage_path: videoStoragePath,
        video_public_url: downloadUrl,
        video_type: videoType || 'short'
      })
      .select()
      .single();


    if (postError || !post) {
      console.error('❌ [Social Publish] Post insertion error:', postError);
      return NextResponse.json({ error: `Error creando post: ${postError?.message || 'Error desconocido'}` }, { status: 500 });
    }

    const publicationIds: string[] = [];

    // 3. Crear registros de social_publications y encolar en background por canal
    for (const accountId of platformAccountIds) {
      // Validar propiedad de la cuenta
      const { data: account } = await supabase
        .from('social_accounts')
        .select('id, platform')
        .eq('id', accountId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!account) {
        console.warn(`⚠️ [Social Publish] Account ${accountId} not found or does not belong to tenant ${tenant.tenantId}`);
        continue;
      }

      const { data: pub, error: pubError } = await supabase
        .from('social_publications')
        .insert({
          post_id: post.id,
          social_account_id: accountId,
          status: 'pending',
          attempts: 0,
          scheduled_at: scheduledAt || null
        })
        .select()
        .single();

      if (pubError || !pub) {
        console.error(`❌ [Social Publish] Failed to insert social_publication:`, pubError);
        continue;
      }

      publicationIds.push(pub.id);

      // 4. Encolar la tarea asíncrona
      const qstashToken = process.env.QSTASH_TOKEN;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const workerUrl = `${appUrl}/api/panel/social/worker`;

      if (qstashToken) {
        // PRODUCCIÓN: Encolar a Upstash QStash
        console.log(`[Social Publish] Enqueuing publication ${pub.id} to QStash...`);
        try {
          const qstashHeaders: Record<string, string> = {
            'Authorization': `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Retries': '3'
          };

          if (process.env.JWT_SECRET) {
            qstashHeaders['Upstash-Forward-X-Worker-Secret'] = process.env.JWT_SECRET;
          }

          // Programar usando Upstash-Not-Before si se define scheduledAt
          if (scheduledAt) {
            const scheduledTimeUnix = Math.floor(new Date(scheduledAt).getTime() / 1000);
            const nowUnix = Math.floor(Date.now() / 1000);
            if (scheduledTimeUnix > nowUnix) {
              qstashHeaders['Upstash-Not-Before'] = scheduledTimeUnix.toString();
              console.log(`[Social Publish] Scheduling task for publication ${pub.id} at ${scheduledAt} (Unix: ${scheduledTimeUnix})`);
            }
          }

          const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(workerUrl)}`, {
            method: 'POST',
            headers: qstashHeaders,
            body: JSON.stringify({ publicationId: pub.id })
          });
          
          if (!qstashRes.ok) {
            console.error(`❌ [Social Publish] QStash enqueue failed for ${pub.id}:`, await qstashRes.text());
          }
        } catch (queueErr) {
          console.error(`❌ [Social Publish] QStash request error:`, queueErr);
        }
      } else {
        // ENTORNO LOCAL (FALLBACK): El frontend se encarga de disparar el worker
        console.log(`[Social Publish] Local dev: Relying on frontend client to trigger worker for publication ${pub.id}`);
      }
    }

    return NextResponse.json({ success: true, postId: post.id, publicationIds });
  } catch (error: any) {
    console.error('❌ [Social Publish] Error processing request:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
