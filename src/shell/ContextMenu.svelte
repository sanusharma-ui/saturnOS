<script lang="ts">
  import { contextMenuStore } from '../core/contextmenu/store';
  import { getIconSvg } from '../assets/icons/icons';

  let menuEl: HTMLDivElement | null = $state(null);
  let adjustedPos = $state({ x: 0, y: 0 });

  $effect(() => {
    if ($contextMenuStore.open) {
      const menuW = 200;
      const menuH = $contextMenuStore.items.length * 32 + 16;
      let x = $contextMenuStore.x;
      let y = $contextMenuStore.y;

      if (x + menuW > window.innerWidth) {
        x = Math.max(10, window.innerWidth - menuW - 10);
      }
      if (y + menuH > window.innerHeight) {
        y = Math.max(10, window.innerHeight - menuH - 10);
      }

      adjustedPos = { x, y };
    }
  });

  function handleItemClick(item: any) {
    if (item.disabled || item.separator) return;
    contextMenuStore.close();
    item.action?.();
  }
</script>

{#if $contextMenuStore.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ctx-backdrop" onclick={() => contextMenuStore.close()} oncontextmenu={(e) => { e.preventDefault(); contextMenuStore.close(); }}>
    <div 
      bind:this={menuEl}
      class="ctx-menu"
      style={`left: ${adjustedPos.x}px; top: ${adjustedPos.y}px;`}
      onclick={(e) => e.stopPropagation()}
    >
      {#each $contextMenuStore.items as item, idx}
        {#if item.separator}
          <div class="ctx-separator"></div>
        {:else}
          <button
            class="ctx-item"
            class:danger={item.danger}
            disabled={item.disabled}
            onclick={() => handleItemClick(item)}
          >
            {#if item.icon}
              <span class="ctx-icon">
                {@html getIconSvg(item.icon, 1.75)}
              </span>
            {/if}
            <span class="ctx-label">{item.label}</span>
            {#if item.shortcut}
              <span class="ctx-shortcut">{item.shortcut}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .ctx-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99999;
  }

  .ctx-menu {
    position: absolute;
    min-width: 180px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 4px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    user-select: none;
    backdrop-filter: blur(16px);
  }

  .ctx-separator {
    height: 1px;
    background: var(--border-color);
    margin: 4px 6px;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }

  .ctx-item:hover:not(:disabled) {
    background: var(--accent-surface);
    color: var(--accent-primary);
  }

  .ctx-item.danger:hover:not(:disabled) {
    background: #ef4444;
    color: #ffffff;
  }

  .ctx-item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .ctx-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
  }

  .ctx-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .ctx-label {
    flex: 1;
    white-space: nowrap;
  }

  .ctx-shortcut {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
