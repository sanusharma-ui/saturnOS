<script lang="ts">
  import { altTabStore } from '../core/wm/store';
  import { wmManager } from '../core/wm/manager';
  import { getIconSvg } from '../assets/icons/icons';

  function handleSelect(id: string) {
    wmManager.restore(id);
    wmManager.focus(id);
    wmManager.cancelAltTab();
  }
</script>

{#if $altTabStore.active && $altTabStore.list.length > 0}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="alttab-overlay" onclick={() => wmManager.cancelAltTab()}>
    <div class="alttab-modal" onclick={(e) => e.stopPropagation()}>
      <div class="alttab-cards">
        {#each $altTabStore.list as win, idx (win.id)}
          <button 
            class="alttab-card" 
            class:selected={idx === $altTabStore.index}
            onclick={() => handleSelect(win.id)}
          >
            <div class="card-icon">
              {@html getIconSvg(win.icon, 1.8)}
            </div>
            <div class="card-title">{win.title}</div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .alttab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    user-select: none;
    backdrop-filter: blur(4px);
  }

  .alttab-modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    max-width: 80vw;
    overflow-x: auto;
  }

  .alttab-cards {
    display: flex;
    gap: 12px;
  }

  .alttab-card {
    width: 110px;
    height: 100px;
    background: var(--bg-card);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px;
    box-sizing: border-box;
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.1s;
  }

  .alttab-card:hover {
    background: var(--bg-hover);
  }

  .alttab-card.selected {
    border-color: var(--accent-primary);
    background: var(--accent-surface);
  }

  .card-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-primary);
  }

  .card-icon :global(svg) {
    width: 36px;
    height: 36px;
  }

  .card-title {
    font-size: 11px;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
</style>
