<script lang="ts">
  import { getIconSvg } from '../../assets/icons/icons';
  import { api } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';

  interface BrowserTab {
    id: string;
    title: string;
    url: string;
    inputUrl: string;
    loading: boolean;
  }

  const QUICK_BOOKMARKS = [
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com', icon: 'search' },
    { title: 'Wikipedia', url: 'https://en.wikipedia.org', icon: 'file' },
    { title: 'GitHub', url: 'https://github.com', icon: 'file-code' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', icon: 'editor' },
    { title: 'Hacker News', url: 'https://news.ycombinator.com', icon: 'monitor' },
    { title: 'Saturn AI', url: 'http://localhost:3000', icon: 'ai' }
  ];

  let tabs = $state<BrowserTab[]>([
    {
      id: 'tab_1',
      title: 'New Tab',
      url: 'https://duckduckgo.com',
      inputUrl: 'https://duckduckgo.com',
      loading: false
    }
  ]);
  let activeTabIdx = $state(0);
  let activeTab = $derived(tabs[activeTabIdx] || tabs[0]);
  let showInstallHint = $state(false);

  function createTab(initialUrl = 'https://duckduckgo.com') {
    const newTab: BrowserTab = {
      id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: 'New Tab',
      url: initialUrl,
      inputUrl: initialUrl,
      loading: false
    };
    tabs = [...tabs, newTab];
    activeTabIdx = tabs.length - 1;
  }

  function closeTab(idx: number, e?: MouseEvent) {
    e?.stopPropagation();
    if (tabs.length <= 1) {
      tabs = [{
        id: `tab_${Date.now()}`,
        title: 'New Tab',
        url: 'https://duckduckgo.com',
        inputUrl: 'https://duckduckgo.com',
        loading: false
      }];
      activeTabIdx = 0;
      return;
    }
    tabs = tabs.filter((_, i) => i !== idx);
    if (activeTabIdx >= tabs.length) {
      activeTabIdx = tabs.length - 1;
    }
  }

  function navigateTo(target: string) {
    if (!activeTab) return;
    let url = target.trim();
    if (!url) return;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = `https://${url}`;
      } else {
        url = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
      }
    }

    activeTab.url = url;
    activeTab.inputUrl = url;
    activeTab.title = url.replace(/^https?:\/\//, '').split('/')[0] || 'Web Page';
    activeTab.loading = true;
  }

  function handleAddressKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      navigateTo(activeTab.inputUrl);
    }
  }

  function reloadPage() {
    if (!activeTab) return;
    const cur = activeTab.url;
    activeTab.url = '';
    activeTab.loading = true;
    setTimeout(() => {
      if (activeTab) activeTab.url = cur;
    }, 50);
  }

  async function launchNativeChromium() {
    try {
      await api.launch('chromium');
      showToast('Browser', 'Launching native Chromium...');
    } catch (err: any) {
      showToast('Launch Error', 'Native Chromium not found. Install it with: doas apk add chromium');
      showInstallHint = true;
    }
  }
</script>

<div class="browser-app">
  <!-- Tabs Bar -->
  <header class="browser-tabs-bar">
    <div class="tabs-list">
      {#each tabs as tab, idx (tab.id)}
        <div
          class="browser-tab"
          class:active={idx === activeTabIdx}
          role="tab"
          tabindex="0"
          onclick={() => (activeTabIdx = idx)}
          onkeydown={(e) => { if (e.key === 'Enter') activeTabIdx = idx; }}
        >
          <span class="tab-icon">🌐</span>
          <span class="tab-title">{tab.title}</span>
          <button
            type="button"
            class="tab-close-btn"
            onclick={(e) => closeTab(idx, e)}
            title="Close Tab"
          >×</button>
        </div>
      {/each}
    </div>

    <button
      type="button"
      class="new-tab-btn"
      onclick={() => createTab()}
      title="New Tab"
    >
      {@html getIconSvg('plus', 1.4)}
    </button>

    <div class="native-launch-area">
      <button
        type="button"
        class="btn-native-chromium"
        onclick={launchNativeChromium}
        title="Open full standalone Chromium on the desktop"
      >
        ⚡ Native Chromium
      </button>
    </div>
  </header>

  <!-- Navigation Toolbar -->
  <div class="browser-toolbar">
    <div class="nav-controls">
      <button type="button" class="tool-btn" onclick={reloadPage} title="Reload">
        {@html getIconSvg('refresh', 1.4)}
      </button>
      <button type="button" class="tool-btn" onclick={() => navigateTo('https://duckduckgo.com')} title="Home">
        {@html getIconSvg('home', 1.4)}
      </button>
    </div>

    <!-- URL Bar -->
    <div class="url-bar-wrapper">
      <span class="url-lock-icon">🔒</span>
      <input
        type="text"
        class="url-input"
        bind:value={activeTab.inputUrl}
        onkeydown={handleAddressKeydown}
        placeholder="Enter URL or search on DuckDuckGo..."
      />
      <button type="button" class="url-go-btn" onclick={() => navigateTo(activeTab.inputUrl)}>
        Go
      </button>
    </div>
  </div>

  <!-- Bookmarks Bar -->
  <div class="bookmarks-bar">
    {#each QUICK_BOOKMARKS as bm}
      <button
        type="button"
        class="bookmark-chip"
        onclick={() => navigateTo(bm.url)}
      >
        <span class="bm-icon">{@html getIconSvg(bm.icon, 1.2)}</span>
        <span>{bm.title}</span>
      </button>
    {/each}
  </div>

  <!-- Installation / Security Notice -->
  {#if showInstallHint}
    <div class="install-banner">
      <span>💡 <strong>Chrome Install Help:</strong> On Alpine Linux, Google Chrome (.deb) cannot install directly. Install official Chromium via Terminal with: <code>doas apk add chromium</code></span>
      <button type="button" class="banner-close" onclick={() => (showInstallHint = false)}>×</button>
    </div>
  {/if}

  <!-- Web Content Viewport -->
  <main class="browser-viewport">
    {#if activeTab && activeTab.url}
      <iframe
        src={activeTab.url}
        title={activeTab.title}
        class="web-frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onload={() => { if (activeTab) activeTab.loading = false; }}
      ></iframe>
    {:else}
      <div class="empty-web-state">
        <div style="font-size: 32px; margin-bottom: 12px;">🌐</div>
        <h2>Saturn Web Browser</h2>
        <p>Browse websites or search with the URL bar above.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .browser-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #181a1f;
    color: #e2e8f0;
    overflow: hidden;
  }

  /* Tabs Bar */
  .browser-tabs-bar {
    display: flex;
    align-items: center;
    background: #1e2227;
    height: 36px;
    padding: 0 8px;
    gap: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
  }

  .browser-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px 6px 0 0;
    font-size: 12px;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
    max-width: 180px;
    white-space: nowrap;
    border: 1px solid transparent;
    border-bottom: none;
    transition: all 0.1s;
  }

  .browser-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .browser-tab.active {
    background: #282c34;
    color: #fff;
    border-color: rgba(255, 255, 255, 0.12);
    font-weight: 500;
  }

  .tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close-btn {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 13px;
    cursor: pointer;
    opacity: 0.6;
    padding: 0 2px;
  }

  .tab-close-btn:hover {
    opacity: 1;
    color: #ef4444;
  }

  .new-tab-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    border-radius: 4px;
  }

  .new-tab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .native-launch-area {
    margin-left: auto;
  }

  .btn-native-chromium {
    background: rgba(234, 88, 12, 0.15);
    border: 1px solid rgba(234, 88, 12, 0.4);
    color: #fb923c;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-native-chromium:hover {
    background: #ea580c;
    color: #fff;
  }

  /* Toolbar */
  .browser-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #21252b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .nav-controls {
    display: flex;
    gap: 4px;
  }

  .tool-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    border-radius: 4px;
  }

  .tool-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .url-bar-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: #181a1f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    height: 30px;
    padding: 0 6px 0 10px;
    gap: 6px;
  }

  .url-lock-icon {
    font-size: 11px;
    opacity: 0.7;
  }

  .url-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 12.5px;
    font-family: inherit;
  }

  .url-go-btn {
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
  }

  .url-go-btn:hover {
    background: #1d4ed8;
  }

  /* Bookmarks */
  .bookmarks-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: #1b1e24;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
  }

  .bookmark-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.1s;
  }

  .bookmark-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .bm-icon {
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
  }

  :global(.bm-icon svg) {
    width: 12px;
    height: 12px;
  }

  /* Install Banner */
  .install-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #3b2d18;
    border-bottom: 1px solid #d97706;
    color: #fbbf24;
    padding: 6px 12px;
    font-size: 12px;
  }

  .install-banner code {
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 6px;
    border-radius: 3px;
    color: #fff;
  }

  .banner-close {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 16px;
    cursor: pointer;
  }

  /* Viewport */
  .browser-viewport {
    flex: 1;
    position: relative;
    background: #fff;
  }

  .web-frame {
    width: 100%;
    height: 100%;
    border: none;
  }

  .empty-web-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: #181a1f;
    color: #94a3b8;
  }

  .empty-web-state h2 {
    color: #fff;
    margin: 0 0 6px;
  }
</style>
