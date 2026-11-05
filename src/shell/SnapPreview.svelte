<script lang="ts">
  import { snapPreviewStore } from '../core/wm/store';
</script>

{#if $snapPreviewStore.visible}
  <div 
    class="snap-preview-box"
    style={`left: ${$snapPreviewStore.x}px; top: ${$snapPreviewStore.y}px; width: ${$snapPreviewStore.width}px; height: ${$snapPreviewStore.height}px;`}
  ></div>
{/if}

<style>
  .snap-preview-box {
    position: fixed;
    background: var(--accent-surface);
    border: 2px solid var(--accent-primary);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    pointer-events: none;
    z-index: 9999;
    transition: all 0.15s ease-out;
    box-shadow: 0 0 20px var(--accent-surface);
  }
</style>
