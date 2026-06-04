/**
 * Service to publish Reels to Facebook Pages and Instagram Business Accounts.
 * Uses native fetch (Node 18+) to avoid adding external dependencies.
 */
export class MetaPublishingService {
  private static API_VERSION = 'v19.0';
  private static BASE_URL = 'https://graph.facebook.com';

  /**
   * Publishes a Reel to a Facebook Page.
   * @param pageId The Facebook Page ID.
   * @param pageAccessToken The Page Access Token.
   * @param videoUrl The signed Supabase Storage video URL.
   * @param caption The description/caption for the Reel.
   * @returns The publication ID/URL or throws an error.
   */
  static async publishFacebookReel(
    pageId: string,
    pageAccessToken: string,
    videoUrl: string,
    caption: string
  ): Promise<{ id: string }> {
    try {
      console.log(`[FB Reels] Starting publication for page: ${pageId}`);

      // Step 1: Initialize the upload
      const initUrl = `${this.BASE_URL}/${this.API_VERSION}/${pageId}/video_reels?upload_phase=START&access_token=${pageAccessToken}`;
      const initRes = await fetch(initUrl, { method: 'POST' });
      const initData: any = await initRes.json();

      if (initData.error) {
        throw new Error(initData.error.message || 'Initialization failed');
      }

      const { video_id, upload_url } = initData;
      if (!video_id || !upload_url) {
        throw new Error('Failed to initialize Facebook Reel upload session. No video_id or upload_url returned.');
      }

      console.log(`[FB Reels] Session initialized. Video ID: ${video_id}`);

      // Step 2: Download the video from Supabase and upload it to Meta
      console.log(`[FB Reels] Fetching video from storage...`);
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video from Storage: ${videoResponse.statusText}`);
      }
      const videoBuffer = await videoResponse.arrayBuffer();

      console.log(`[FB Reels] Uploading video binary (${videoBuffer.byteLength} bytes) to Meta...`);
      const uploadRes = await fetch(upload_url, {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${pageAccessToken}`,
          'Content-Type': 'application/octet-stream',
          'offset': '0',
          'file_size': videoBuffer.byteLength.toString()
        },
        body: videoBuffer,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        throw new Error(`Upload to Meta failed: ${uploadErr}`);
      }

      console.log(`[FB Reels] Video upload completed. Finalizing publication...`);

      // Step 3: Publish the Reel
      const finalizeUrl = `${this.BASE_URL}/${this.API_VERSION}/${pageId}/video_reels?upload_phase=FINISH&video_id=${video_id}&video_state=PUBLISHED&description=${encodeURIComponent(caption)}&access_token=${pageAccessToken}`;
      const finalizeRes = await fetch(finalizeUrl, { method: 'POST' });
      const finalizeData: any = await finalizeRes.json();

      if (finalizeData.error) {
        throw new Error(finalizeData.error.message || 'Finalization failed');
      }

      console.log(`[FB Reels] Facebook Reel finalized:`, finalizeData);
      return { id: video_id };
    } catch (error: any) {
      console.error(`[FB Reels] Error publishing Reel:`, error.message || error);
      throw new Error(`Facebook Reels API Error: ${error.message || error}`);
    }
  }

  /**
   * Publishes a standard long video to a Facebook Page.
   * Uses URL-based publishing directly to Meta's servers to avoid large server-side uploads.
   * @param pageId The Facebook Page ID.
   * @param pageAccessToken The Page Access Token.
   * @param videoUrl The signed Supabase Storage video URL.
   * @param caption The description/caption for the video.
   * @param title The title of the video.
   * @returns The published video ID.
   */
  static async publishFacebookVideo(
    pageId: string,
    pageAccessToken: string,
    videoUrl: string,
    caption: string,
    title?: string
  ): Promise<{ id: string }> {
    try {
      console.log(`[FB Video] Starting standard video publication for page: ${pageId}`);
      const url = `${this.BASE_URL}/${this.API_VERSION}/${pageId}/videos`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: videoUrl,
          description: caption,
          title: title || '',
          access_token: pageAccessToken
        })
      });
      const data: any = await res.json();
      if (data.error) {
        throw new Error(data.error.message || 'Facebook Video upload failed');
      }
      console.log(`[FB Video] Facebook standard video published:`, data);
      return { id: data.id };
    } catch (error: any) {
      console.error(`[FB Video] Error publishing Video:`, error.message || error);
      throw new Error(`Facebook Video API Error: ${error.message || error}`);
    }
  }

  /**
   * Publishes a Reel to an Instagram Business Account.
   * @param igUserId The Instagram Business Account ID.
   * @param userAccessToken Long-lived User/Page Access Token.
   * @param videoUrl The signed Supabase Storage video URL.
   * @param caption The description/caption for the Reel.
   * @param logCallback Callback function to write live logs to database.
   * @returns The published media ID.
   */
  static async publishInstagramReel(
    igUserId: string,
    userAccessToken: string,
    videoUrl: string,
    caption: string,
    logCallback?: (message: string, level?: 'info' | 'warning' | 'error') => Promise<void>
  ): Promise<{ id: string }> {
    try {
      const log = async (msg: string, lvl: 'info' | 'warning' | 'error' = 'info') => {
        console.log(`[IG Reels] ${msg}`);
        if (logCallback) await logCallback(msg, lvl);
      };

      await log(`Starting media container creation for Instagram account: ${igUserId}`);

      // Step 1: Create the media container
      const containerUrl = `${this.BASE_URL}/${this.API_VERSION}/${igUserId}/media?media_type=REELS&video_url=${encodeURIComponent(videoUrl)}&caption=${encodeURIComponent(caption)}&share_to_feed=true&access_token=${userAccessToken}`;
      const containerRes = await fetch(containerUrl, { method: 'POST' });
      const containerData: any = await containerRes.json();

      if (containerData.error) {
        throw new Error(containerData.error.message || 'Container creation failed');
      }

      const containerId = containerData.id;
      if (!containerId) {
        throw new Error('Failed to create Instagram media container. No ID returned.');
      }

      await log(`Media container created successfully. Container ID: ${containerId}. Waiting for Meta transcoding...`);

      // Step 2: Poll status of the container
      const statusUrl = `${this.BASE_URL}/${this.API_VERSION}/${containerId}?fields=status_code,status&access_token=${userAccessToken}`;
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 90; // 90 * 10 seconds = 900 seconds (15 minutes max for longer videos)

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 10000)); // wait 10 seconds

        const statusRes = await fetch(statusUrl);
        const statusData: any = await statusRes.json();

        if (statusData.error) {
          throw new Error(statusData.error.message || 'Status check failed');
        }

        const code = statusData.status_code;
        console.log(`[IG Reels] Polling attempt ${attempts}: ${code}`);
        
        if (code === 'FINISHED') {
          status = 'FINISHED';
        } else if (code === 'ERROR' || code === 'EXPIRED') {
          status = 'FAILED';
          throw new Error(`Meta transcoding failed with code: ${code}. Detailed error: ${statusData.status || 'Unknown error'}`);
        }
      }

      if (status !== 'FINISHED') {
        throw new Error('Meta transcoding timed out after 5 minutes.');
      }

      await log(`Meta transcoding finished successfully. Publishing container...`);

      // Step 3: Publish the container
      const publishUrl = `${this.BASE_URL}/${this.API_VERSION}/${igUserId}/media_publish?creation_id=${containerId}&access_token=${userAccessToken}`;
      const publishRes = await fetch(publishUrl, { method: 'POST' });
      const publishData: any = await publishRes.json();

      if (publishData.error) {
        throw new Error(publishData.error.message || 'Publishing failed');
      }

      const mediaId = publishData.id;
      await log(`Instagram Reel published successfully! Media ID: ${mediaId}`);
      return { id: mediaId };
    } catch (error: any) {
      console.error(`[IG Reels] Error publishing Reel:`, error.message || error);
      throw new Error(`Instagram Reels API Error: ${error.message || error}`);
    }
  }
}
