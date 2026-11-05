<script lang="ts">
  import { onMount } from 'svelte';
  import { ALL_APPS, launchApp } from '../core/registry/appRegistry';
  import { searchEverything, type SearchResult } from '../core/search/searchEngine';
  import { getIconSvg } from '../assets/icons/icons';
  import { api } from '../core/api/client';
  import { notifications } from '../core/notifications/store';

  interface Props {
    open: boolean;
    onclose: () => void;
    onlock: () => void;
  }

  let { open, onclose, onlock }: Props = $props();

  let query = $state('');
  let searchResults = $state<SearchResult[]>([]);
  let selectedIdx = $state(0);
  let searchInputEl: HTMLInputElement | null = $state(null);
  let debounceTimer: any;

  $effect(() => {
    if (open) {
      setTimeout(() => {
        searchInputEl?.focus();
      }, 50);
    } else {
      query = '';
      searchResults = [];
      selectedIdx = 0;
    }
  });

  function handleInput() {
    clearTimeout(debounceTimer);
    if (!query.trim()) {
      searchResults = [];
      return;
    }
    debounceTimer = setTimeout(async () => {
      searchResults = await searchEverything(query);
      selectedIdx = 0;
    }, 150);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % searchResults.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + searchResults.length) % searchResults.length;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = searchResults[selectedIdx];
        if (item) {
          item.action();
          onclose();
        }
      }
    }
  }

  function selectApp(appId: string) {
    launchApp(appId);
    onclose();
  }

  async function handlePower(action: 'poweroff' | 'reboot') {
    onclose();
    try {
      await api.power(action);
    } catch (e: any) {
      notifications.add({ title: 'Power Error', message: e.message, type: 'error' });
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="launcher-backdrop" onclick={onclose}>
    <div class="launcher-panel" onclick={(e) => e.stopPropagation()}>
      <!-- Search Bar -->
      <div class="launcher-search">
        <span class="search-icon">
          {@html getIconSvg('search', 1.75)}
        </span>
        <input
          bind:this={searchInputEl}
          type="text"
          placeholder="Search apps, files, settings..."
          bind:value={query}
          oninput={handleInput}
          onkeydown={handleKeyDown}
          class="search-input"
        />
        {#if query}
          <button class="clear-btn" onclick={() => { query = ''; searchResults = []; }}>×</button>
        {/if}
      </div>

      <!-- Content: Search Results OR App Grid -->
      <div class="launcher-body">
        {#if query.trim()}
          <div class="search-results-list">
            {#if searchResults.length === 0}
              <div class="no-results">No matches found for "{query}"</div>
            {:else}
              {#each searchResults as res, idx}
                <button
                  class="search-res-item"
                  class:selected={idx === selectedIdx}
                  onclick={() => { res.action(); onclose(); }}
                >
                  <span class="res-icon">
                    {@html getIconSvg(res.icon, 1.75)}
                  </span>
                  <div class="res-info">
                    <span class="res-title">{res.title}</span>
                    {#if res.subtitle}
                      <span class="res-sub">{res.subtitle}</span>
                    {/if}
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        {:else}
          <div class="apps-grid-view">
            <div class="section-title">Applications</div>
            <div class="apps-grid">
              {#each ALL_APPS as app (app.id)}
                <button class="app-card" onclick={() => selectApp(app.id)}>
                  <div class="app-card-icon">
                    {@html getIconSvg(app.icon, 1.75)}
                  </div>
                  <span class="app-card-name">{app.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer / User & Power -->
      <div class="launcher-footer">
        <div class="user-pill">
          <div class="user-avatar">S</div>
          <span class="user-name">sanu</span>
        </div>

        <div class="power-buttons">
          <button class="pwr-btn" onclick={() => { onclose(); onlock(); }} title="Lock Screen">
            {@html getIconSvg('lock', 1.75)}
          </button>
          <button class="pwr-btn" onclick={() => handlePower('reboot')} title="Restart">
            {@html getIconSvg('refresh', 1.75)}
          </button>
          <button class="pwr-btn pwr-off" onclick={() => handlePower('poweroff')} title="Shut Down">
            {@html getIconSvg('power', 1.75)}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .launcher-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 46px; /* above taskbar */
    z-index: 1001;
  }

  .launcher-panel {
    position: absolute;
    bottom: 12px;
    left: 12px;
    width: 480px;
    height: 520px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(24px);
    user-select: none;
    box-sizing: border-box;
  }

  .launcher-search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-card);
  }

  .search-icon {
    width: 18px;
    height: 18px;
    color: var(--text-muted);
    display: flex;
  }

  .search-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
  }

  .clear-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
  }

  .launcher-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .apps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 6px;
    background: var(--bg-card);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }

  .app-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
    transform: translateY(-2px);
  }

  .app-card-icon {
    width: 32px;
    height: 32px;
    color: var(--accent-primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-card-icon :global(svg) {
    width: 30px;
    height: 30px;
  }

  .app-card-name {
    font-size: 11px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }

  /* Search Results */
  .search-results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .search-res-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .search-res-item:hover, .search-res-item.selected {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .res-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    color: var(--accent-primary);
  }

  .res-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .res-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .res-title {
    font-size: 13px;
    font-weight: 500;
  }

  .res-sub {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Footer */
  .launcher-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-card);
  }

  .user-pill {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .power-buttons {
    display: flex;
    gap: 6px;
  }

  .pwr-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .pwr-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .pwr-btn.pwr-off:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .pwr-btn :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
