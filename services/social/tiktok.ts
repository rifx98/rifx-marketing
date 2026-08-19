import { randomUUID } from 'crypto';
import {
  abortableDelay,
  assertProviderUploadUrl,
  providerHttpError,
  providerInvalidResponse,
  providerNetworkError,
  readProviderJson,
  throwIfAborted,
} from '@/services/social/provider-error';

type SocialLog = (message: string, level?: 'info' | 'warning' | 'error') => Promise<void>;
const MEBIBYTE = 1024 * 1024;

export class TikTokPublishingService {
  static async publishVideo(
    accessToken: string,
    videoUrl: string,
    caption: string,
    logCallback?: SocialLog,
    signal?: AbortSignal,
    contentType = 'video/mp4',
  ): Promise<{ id: string }> {
    const log = async (message: string) => logCallback?.(message, 'info');
    throwIfAborted(signal);

    if (accessToken.startsWith('mock_') || process.env.MOCK_SOCIAL_API === 'true') {
      await log('Ejecutando publicación simulada de TikTok.');
      await abortableDelay(500, signal);
      return { id: `tt_mock_${randomUUID()}` };
    }

    await log('Preparando video para TikTok.');
    let videoResponse: Response;
    try {
      videoResponse = await fetch(videoUrl, {
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      throw providerNetworkError('storage', 'tiktok_download');
    }
    if (!videoResponse.ok) {
      await videoResponse.body?.cancel().catch(() => undefined);
      throw providerHttpError('storage', 'tiktok_download', videoResponse.status);
    }
    const videoBuffer = await videoResponse.arrayBuffer().catch(() => {
      throw providerNetworkError('storage', 'tiktok_download');
    });
    const videoSize = videoBuffer.byteLength;
    const chunkSize = videoSize > 64 * MEBIBYTE ? 32 * MEBIBYTE : videoSize;
    const totalChunkCount = Math.max(1, Math.floor(videoSize / chunkSize));

    let initialization: Response;
    try {
      initialization = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: caption || '',
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: chunkSize,
            total_chunk_count: totalChunkCount,
          },
        }),
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      throw providerNetworkError('tiktok', 'upload_init');
    }
    const initialized = await readProviderJson(initialization, 'tiktok', 'upload_init');
    if (!initialization.ok || initialized.error?.code) {
      throw providerHttpError('tiktok', 'upload_init', initialization.status);
    }
    const publishId = typeof initialized.data?.publish_id === 'string'
      ? initialized.data.publish_id
      : '';
    const uploadUrl = assertProviderUploadUrl(
      initialized.data?.upload_url,
      ['tiktokapis.com'],
    );
    if (!publishId || publishId.length > 200) {
      throw providerInvalidResponse('tiktok', 'upload_init');
    }

    await log('Subiendo video a TikTok.');
    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex += 1) {
      const firstByte = chunkIndex * chunkSize;
      const finalChunk = chunkIndex === totalChunkCount - 1;
      const lastByteExclusive = finalChunk ? videoSize : firstByte + chunkSize;
      const chunk = videoBuffer.slice(firstByte, lastByteExclusive);
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunk.byteLength),
            'Content-Range': `bytes ${firstByte}-${lastByteExclusive - 1}/${videoSize}`,
          },
          body: chunk,
          cache: 'no-store',
          redirect: 'error',
          signal,
        });
      } catch {
        // Only the final chunk starts TikTok processing. Earlier upload
        // sessions may be abandoned and safely recreated.
        throw providerNetworkError('tiktok', 'upload_binary', finalChunk);
      }
      const expectedStatus = finalChunk ? 201 : 206;
      if (uploadResponse.status !== expectedStatus) {
        await uploadResponse.body?.cancel().catch(() => undefined);
        throw providerHttpError('tiktok', 'upload_binary', uploadResponse.status, finalChunk);
      }
      await uploadResponse.body?.cancel().catch(() => undefined);
    }
    await log('TikTok aceptó la publicación.');
    return { id: publishId };
  }
}
