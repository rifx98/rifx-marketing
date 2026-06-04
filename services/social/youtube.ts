/**
 * Service to publish YouTube Shorts using the YouTube Data API v3.
 */
export class YouTubePublishingService {
  /**
   * Publishes a video to YouTube Shorts.
   * YouTube automatically treats videos under 60 seconds with vertical aspect ratio as Shorts.
   */
  static async publishShort(
    accessToken: string,
    videoUrl: string,
    title: string,
    description: string,
    logCallback?: (message: string, level?: 'info' | 'warning' | 'error') => Promise<void>
  ): Promise<{ id: string }> {
    const log = async (msg: string, lvl: 'info' | 'warning' | 'error' = 'info') => {
      console.log(`[YouTube Shorts] ${msg}`);
      if (logCallback) await logCallback(msg, lvl);
    };

    try {
      await log('Iniciando proceso de publicación en YouTube Shorts...');

      // Sandbox Mock Mode detection
      if (accessToken.startsWith('mock_') || process.env.MOCK_SOCIAL_API === 'true') {
        await log('⚠️ [Sandbox] Detectado token sandbox o modo de simulación.');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await log('📥 [Sandbox] Descargando video de Supabase Storage...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await log('📤 [Sandbox] Subiendo video binario al endpoint de YouTube...');
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await log('⚙️ [Sandbox] Procesando Shorts en los servidores de Google...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await log('🎉 [Sandbox] YouTube Shorts publicado con éxito en el canal.');
        return { id: `yt_mock_${Math.random().toString(36).substring(2, 11)}` };
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

      // Step 2: Initialize resumable upload session
      await log('Inicializando sesión de subida resumible en YouTube API...');
      const initUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
      
      const metadata = {
        snippet: {
          title: title || 'RIFX Short Video',
          description: description || '',
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      };

      const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': 'video/mp4'
        },
        body: JSON.stringify(metadata)
      });

      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`Falló la inicialización de YouTube: ${initRes.status} ${errText}`);
      }

      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('No se retornó la cabecera Location para la subida.');
      }
      await log('Sesión iniciada. Subiendo archivo binario de video a los servidores de Google...');

      // Step 3: Upload the video buffer
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4'
        },
        body: videoBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Falló la subida del video a YouTube: ${uploadRes.status} ${errText}`);
      }

      const finalData: any = await uploadRes.json();
      const videoId = finalData.id;

      if (!videoId) {
        throw new Error('No se recibió ID del video subido.');
      }

      await log(`¡YouTube Shorts publicado con éxito! Video ID: ${videoId}`);
      return { id: videoId };
    } catch (error: any) {
      console.error('[YouTube Shorts] Error details:', error);
      throw new Error(`YouTube API Error: ${error.message || error}`);
    }
  }
}
