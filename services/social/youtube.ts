import { randomUUID } from 'crypto';
import {
  abortableDelay,
  assertProviderUploadUrl,
  providerHttpError,
  providerInvalidResponse,
  providerNetworkError,
  readProviderJson,
  SocialProviderError,
  throwIfAborted,
} from '@/services/social/provider-error';

type SocialLog = (message: string, level?: 'info' | 'warning' | 'error') => Promise<void>;

export class YouTubePublishingService {
  static async publishShort(
    accessToken: string,
    videoUrl: string,
    title: string,
    description: string,
    logCallback?: SocialLog,
    signal?: AbortSignal,
    contentType = 'video/mp4',
  ): Promise<{ id: string }> {
    const log = async (message: string) => logCallback?.(message, 'info');
    throwIfAborted(signal);

    if (accessToken.startsWith('mock_') || process.env.MOCK_SOCIAL_API === 'true') {
      await log('Ejecutando publicación simulada de YouTube.');
      await abortableDelay(500, signal);
      return { id: `yt_mock_${randomUUID()}` };
    }

    await log('Preparando video para YouTube.');
    let videoResponse: Response;
    try {
      videoResponse = await fetch(videoUrl, {
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      throw providerNetworkError('storage', 'youtube_download');
    }
    if (!videoResponse.ok) {
      await videoResponse.body?.cancel().catch(() => undefined);
      throw providerHttpError('storage', 'youtube_download', videoResponse.status);
    }
    const videoBuffer = await videoResponse.arrayBuffer().catch(() => {
      throw providerNetworkError('storage', 'youtube_download');
    });

    const metadata = {
      snippet: {
        title: title || 'RIFX Short Video',
        description: description || '',
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    let initialization: Response;
    try {
      initialization = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': String(videoBuffer.byteLength),
            'X-Upload-Content-Type': contentType,
          },
          body: JSON.stringify(metadata),
          cache: 'no-store',
          redirect: 'error',
          signal,
        },
      );
    } catch {
      throw providerNetworkError('youtube', 'upload_init');
    }
    if (!initialization.ok) {
      await initialization.body?.cancel().catch(() => undefined);
      throw providerHttpError('youtube', 'upload_init', initialization.status);
    }
    await initialization.body?.cancel().catch(() => undefined);

    const uploadUrl = assertProviderUploadUrl(
      initialization.headers.get('location'),
      ['googleapis.com'],
    );
    await log('Subiendo video a YouTube.');

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': String(videoBuffer.byteLength),
          'Content-Type': contentType,
        },
        body: videoBuffer,
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      // A completed resumable upload creates the video. Without persisting and
      // querying the session URI, a network timeout cannot be retried safely.
      throw providerNetworkError('youtube', 'upload_binary', true);
    }
    if (!uploadResponse.ok) {
      throw providerHttpError('youtube', 'upload_binary', uploadResponse.status, true);
    }
    const finalPayload = await readProviderJson(
      uploadResponse,
      'youtube',
      'upload_binary',
      true,
    );
    const videoId = typeof finalPayload.id === 'string' ? finalPayload.id : '';
    if (!videoId || videoId.length > 200) {
      throw providerInvalidResponse('youtube', 'upload_binary', true);
    }
    await log('YouTube confirmó la publicación.');
    return { id: videoId };
  }
}

export { SocialProviderError };
