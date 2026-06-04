/**
 * Service to publish video posts using TikTok Content Posting API v2.
 */
export class TikTokPublishingService {
  /**
   * Publishes a video to TikTok.
   */
  static async publishVideo(
    accessToken: string,
    videoUrl: string,
    caption: string,
    logCallback?: (message: string, level?: 'info' | 'warning' | 'error') => Promise<void>
  ): Promise<{ id: string }> {
    const log = async (msg: string, lvl: 'info' | 'warning' | 'error' = 'info') => {
      console.log(`[TikTok] ${msg}`);
      if (logCallback) await logCallback(msg, lvl);
    };

    try {
      await log('Iniciando proceso de publicación en TikTok...');

      // Sandbox Mock Mode detection
      if (accessToken.startsWith('mock_') || process.env.MOCK_SOCIAL_API === 'true') {
        await log('⚠️ [Sandbox] Detectado token sandbox o modo de simulación.');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await log('📥 [Sandbox] Descargando video de Supabase Storage...');
        await new Promise((resolve) => setTimeout(resolve, 3500));
        await log('⚙️ [Sandbox] Inicializando sesión de subida en TikTok Content API...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await log('📤 [Sandbox] Subiendo fragmentos binarios a los servidores de TikTok...');
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await log('🎉 [Sandbox] TikTok publicado con éxito en tu perfil.');
        return { id: `tt_mock_${Math.random().toString(36).substring(2, 11)}` };
      }

      // Step 1: Download the video binary
      await log('Descargando archivo de video de Supabase Storage...');
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Error al descargar video del storage: ${videoResponse.statusText}`);
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      const videoSize = videoBuffer.byteLength;
      await log(`Descarga completa. Tamaño del video: ${videoSize} bytes.`);

      // Step 2: Initialize Direct Post upload session
      await log('Inicializando sesión de publicación directa en TikTok...');
      const initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
      
      const bodyParams = {
        post_info: {
          title: caption || '',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1
        }
      };

      const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(bodyParams)
      });

      const initData: any = await initRes.json();
      if (initData.error || !initRes.ok) {
        throw new Error(initData.error?.message || `Falló la inicialización de TikTok: ${initRes.status}`);
      }

      const { publish_id, upload_url } = initData.data;
      if (!publish_id || !upload_url) {
        throw new Error('TikTok no retornó publish_id o upload_url.');
      }
      await log(`Sesión inicializada. ID de publicación: ${publish_id}. Subiendo video binario...`);

      // Step 3: Upload the video buffer
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
        },
        body: videoBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Falló la subida binaria a TikTok: ${uploadRes.status} ${errText}`);
      }

      await log(`¡TikTok publicado con éxito! ID de Publicación: ${publish_id}`);
      return { id: publish_id };
    } catch (error: any) {
      console.error('[TikTok] Error details:', error);
      throw new Error(`TikTok API Error: ${error.message || error}`);
    }
  }
}
