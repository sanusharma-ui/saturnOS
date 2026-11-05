<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getIconSvg } from '../../assets/icons/icons';

  export let arg: string | undefined = undefined;

  let mediaEl: HTMLVideoElement | HTMLAudioElement | null = null;

  $: filePath = typeof arg === 'string' ? arg : '';
  $: fileName = filePath ? filePath.split('/').pop() : '';
  $: ext = fileName ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  $: fileUrl = filePath ? `/api/file?path=${encodeURIComponent(filePath)}` : '';

  $: isImage = /^(png|jpe?g|webp|gif|svg|bmp)$/.test(ext);
  $: isAudio = /^(mp3|wav|ogg|flac|m4a)$/.test(ext);
  $: isVideo = /^(mp4|webm)$/.test(ext);

  onDestroy(() => {
    if (mediaEl) {
      mediaEl.pause();
      mediaEl.removeAttribute('src');
      mediaEl.load();
    }
  });
</script>

<div class="media-app">
  {#if !filePath}
    <div class="empty-state">
      <div style="width: 48px; height: 48px; margin: 0 auto 12px; color: var(--text-dim);">
        {@html getIconSvg('viewer')}
      </div>
      <div>Open an image, audio, or video file from Files</div>
    </div>
  {:else if isImage}
    <img src={fileUrl} alt={fileName} class="media-img" />
  {:else if isVideo}
    <video src={fileUrl} controls autoplay bind:this={mediaEl} class="media-video"></video>
  {:else if isAudio}
    <div class="media-audio-card">
      <div class="audio-badge">
        {@html getIconSvg('file-audio')}
      </div>
      <div class="audio-title">{fileName}</div>
      <audio src={fileUrl} controls autoplay bind:this={mediaEl} style="width: 100%;"></audio>
    </div>
  {:else}
    <div class="empty-state">Unsupported file format</div>
  {/if}
</div>

<style>
  .media-app {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #000000;
    overflow: hidden;
    position: relative;
  }
  .empty-state {
    color: var(--text-muted);
    text-align: center;
    font-size: 13px;
  }
  .media-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .media-video {
    max-width: 100%;
    max-height: 100%;
    outline: none;
  }
  .media-audio-card {
    width: 85%;
    max-width: 440px;
    background: var(--surface-solid, #222838);
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.2));
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #ffffff;
  }
  .audio-badge {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: linear-gradient(145deg, #fbbf24, #d97706);
    display: grid;
    place-items: center;
    color: #ffffff;
  }
  :global(.audio-badge svg) {
    width: 28px;
    height: 28px;
  }
  .audio-title {
    font-weight: 600;
    font-size: 14px;
    text-align: center;
    word-break: break-all;
  }
</style>
