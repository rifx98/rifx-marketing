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

function graphVersion(): string {
  const configured = process.env.META_GRAPH_API_VERSION?.trim();
  return configured && /^v\d{1,2}\.\d$/u.test(configured) ? configured : 'v24.0';
}

async function graphFormRequest(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
  signal: AbortSignal | undefined,
  phase: string,
  ambiguous = false,
): Promise<Record<string, any>> {
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion()}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(fields),
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
  } catch (error) {
    if (error instanceof SocialProviderError) throw error;
    throw providerNetworkError('meta', phase, ambiguous);
  }

  const payload = await readProviderJson(response, 'meta', phase, ambiguous);
  if (!response.ok || payload.error) {
    throw providerHttpError('meta', phase, response.status, ambiguous);
  }
  return payload;
}

async function graphGetRequest(
  path: string,
  accessToken: string,
  signal: AbortSignal | undefined,
  phase: string,
): Promise<Record<string, any>> {
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${graphVersion()}/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
  } catch {
    throw providerNetworkError('meta', phase);
  }
  const payload = await readProviderJson(response, 'meta', phase);
  if (!response.ok || payload.error) throw providerHttpError('meta', phase, response.status);
  return payload;
}

export class MetaPublishingService {
  static async publishFacebookReel(
    pageId: string,
    pageAccessToken: string,
    videoUrl: string,
    caption: string,
    signal?: AbortSignal,
  ): Promise<{ id: string }> {
    throwIfAborted(signal);
    const initialized = await graphFormRequest(
      `${encodeURIComponent(pageId)}/video_reels`,
      pageAccessToken,
      { upload_phase: 'START' },
      signal,
      'facebook_reel_start',
    );
    const videoId = typeof initialized.video_id === 'string' ? initialized.video_id : '';
    const uploadUrl = assertProviderUploadUrl(initialized.upload_url, ['facebook.com', 'fbcdn.net']);
    if (!videoId || videoId.length > 200) {
      throw providerInvalidResponse('meta', 'facebook_reel_start');
    }

    let videoResponse: Response;
    try {
      videoResponse = await fetch(videoUrl, {
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      throw providerNetworkError('storage', 'facebook_reel_download');
    }
    if (!videoResponse.ok) {
      await videoResponse.body?.cancel().catch(() => undefined);
      throw providerHttpError('storage', 'facebook_reel_download', videoResponse.status);
    }
    const videoBuffer = await videoResponse.arrayBuffer().catch(() => {
      throw providerNetworkError('storage', 'facebook_reel_download');
    });

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${pageAccessToken}`,
          'Content-Type': 'application/octet-stream',
          offset: '0',
          file_size: String(videoBuffer.byteLength),
        },
        body: videoBuffer,
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
    } catch {
      // The upload session may have received the binary, but no visible post
      // exists until FINISH. Starting a fresh session is safe.
      throw providerNetworkError('meta', 'facebook_reel_upload');
    }
    if (!uploadResponse.ok) {
      await uploadResponse.body?.cancel().catch(() => undefined);
      throw providerHttpError('meta', 'facebook_reel_upload', uploadResponse.status);
    }
    await uploadResponse.body?.cancel().catch(() => undefined);

    const finalized = await graphFormRequest(
      `${encodeURIComponent(pageId)}/video_reels`,
      pageAccessToken,
      {
        upload_phase: 'FINISH',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: caption,
      },
      signal,
      'facebook_reel_finish',
      true,
    );
    if (finalized.success === false) {
      throw providerInvalidResponse('meta', 'facebook_reel_finish', true);
    }
    return { id: videoId };
  }

  static async publishFacebookVideo(
    pageId: string,
    pageAccessToken: string,
    videoUrl: string,
    caption: string,
    title?: string,
    signal?: AbortSignal,
  ): Promise<{ id: string }> {
    const payload = await graphFormRequest(
      `${encodeURIComponent(pageId)}/videos`,
      pageAccessToken,
      {
        file_url: videoUrl,
        description: caption,
        title: title || '',
      },
      signal,
      'facebook_video_publish',
      true,
    );
    const id = typeof payload.id === 'string' ? payload.id : '';
    if (!id || id.length > 200) {
      throw providerInvalidResponse('meta', 'facebook_video_publish', true);
    }
    return { id };
  }

  static async publishInstagramReel(
    igUserId: string,
    userAccessToken: string,
    videoUrl: string,
    caption: string,
    logCallback?: SocialLog,
    signal?: AbortSignal,
  ): Promise<{ id: string }> {
    await logCallback?.('Creando contenedor seguro de Instagram Reel.');
    const container = await graphFormRequest(
      `${encodeURIComponent(igUserId)}/media`,
      userAccessToken,
      {
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        share_to_feed: 'true',
      },
      signal,
      'instagram_container',
    );
    const containerId = typeof container.id === 'string' ? container.id : '';
    if (!containerId || containerId.length > 200) {
      throw providerInvalidResponse('meta', 'instagram_container');
    }

    // The synchronous Netlify route has a fixed 60-second ceiling. Poll only
    // while the worker's 45-second provider budget remains; a deadline is
    // dead-lettered because recreating/publishing blindly risks duplication.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await abortableDelay(8_000, signal);
      const statusPayload = await graphGetRequest(
        `${encodeURIComponent(containerId)}?fields=status_code,status`,
        userAccessToken,
        signal,
        'instagram_status',
      );
      const status = typeof statusPayload.status_code === 'string'
        ? statusPayload.status_code.toUpperCase()
        : '';
      if (status === 'FINISHED') {
        await logCallback?.('Instagram terminó de procesar el contenedor.');
        const published = await graphFormRequest(
          `${encodeURIComponent(igUserId)}/media_publish`,
          userAccessToken,
          { creation_id: containerId },
          signal,
          'instagram_publish',
          true,
        );
        const mediaId = typeof published.id === 'string' ? published.id : '';
        if (!mediaId || mediaId.length > 200) {
          throw providerInvalidResponse('meta', 'instagram_publish', true);
        }
        return { id: mediaId };
      }
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new SocialProviderError('meta_instagram_transcode_failed', 'dead');
      }
      if (status !== 'IN_PROGRESS') {
        throw providerInvalidResponse('meta', 'instagram_status');
      }
    }

    throw new SocialProviderError('meta_instagram_processing_exceeds_sync_budget', 'ambiguous');
  }
}
