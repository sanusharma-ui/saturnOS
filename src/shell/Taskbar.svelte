<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getIconSvg } from '../assets/icons/icons';
  import { windowsStore, activeWindowIdStore } from '../core/wm/store';
  import { wmManager } from '../core/wm/manager';
  import { APP_REGISTRY, launchApp } from '../core/registry/appRegistry';
  import { api } from '../core/api/client';
  import type { WindowInstance } from '../core/wm/types';

  interface Props {
    launcherOpen: boolean;
    quickSettingsOpen: boolean;
    ontoggleLauncher: () => void;
    onOpenSearch: () => void;
    ontoggleQuickSettings: () => void;
  }

  let { launcherOpen, quickSettingsOpen, ontoggleLauncher, onOpenSearch, ontoggleQuickSettings }: Props = $props();

  // Clock
  let timeStr = $state('');
  let dateStr = $state('');
  let clockInterval: any;

  // Battery
  let batteryInfo = $state<{ present: boolean; percent: number; charging: boolean } | null>(null);
  let batteryInterval: any;

  // Sound/Mute state
  let isMuted = $state(false);

  // Pinned App IDs
  const PINNED_APP_IDS = ['files', 'editor', 'terminal', 'browser', 'ai', 'monitor', 'settings'];

  onMount(() => {
    const updateTime = () => {
      const d = new Date();
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };
    updateTime();
    clockInterval = setInterval(updateTime, 1000);

    const checkSys = async () => {
      try {
        const res = await api.sysinfo();
        if (res.ok && res.battery && res.battery.present) {
          batteryInfo = res.battery;
        } else {
          batteryInfo = null;
        }
      } catch {}
    };
    checkSys();
    batteryInterval = setInterval(checkSys, 30000);
  });

  onDestroy(() => {
    clearInterval(clockInterval);
    clearInterval(batteryInterval);
  });

  // Handle taskbar button click for an app
  function handleAppClick(appId: string) {
    const appWins = $windowsStore.filter(w => w.appId === appId);
    if (appWins.length === 0) {
      launchApp(appId);
      return;
    }

    if (appWins.length === 1) {
      const win = appWins[0];
      if (win.minimized) {
        wmManager.restore(win.id);
      } else if ($activeWindowIdStore === win.id) {
        wmManager.minimize(win.id);
      } else {
        wmManager.focus(win.id);
      }
    } else {
      // Multiple instances: cycle or bring active
      const activeInGroup = appWins.find(w => w.id === $activeWindowIdStore);
      if (activeInGroup) {
        const nextIdx = (appWins.indexOf(activeInGroup) + 1) % appWins.length;
        wmManager.focus(appWins[nextIdx].id);
      } else {
        wmManager.focus(appWins[0].id);
      }
    }
  }

  // Show desktop toggle
  let prevMinimizedIds: string[] = [];
  function toggleShowDesktop() {
    const nonMinimized = $windowsStore.filter(w => !w.minimized);
    if (nonMinimized.length > 0) {
      prevMinimizedIds = nonMinimized.map(w => w.id);
      nonMinimized.forEach(w => wmManager.minimize(w.id));
    } else {
      prevMinimizedIds.forEach(id => wmManager.restore(id));
      prevMinimizedIds = [];
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<footer class="taskbar" onclick={(e) => e.stopPropagation()}>
  <div class="taskbar-left">
    <!-- Start Button -->
    <button 
      class="start-btn" 
      class:active={launcherOpen} 
      onclick={(e) => {
        e.stopPropagation();
        ontoggleLauncher();
      }}
      title="Start Menu (Super / Meta)"
    >
      <span class="start-icon">
        {@html getIconSvg('saturn', 1.8)}
      </span>
      <span class="start-text">Saturn</span>
    </button>

    <!-- Search Quick Trigger -->
    <button 
      class="taskbar-search-btn"
      onclick={(e) => {
        e.stopPropagation();
        onOpenSearch();
      }}
      title="Search apps and files (Ctrl+Space)"
    >
      <span class="search-icon">
        {@html getIconSvg('search', 1.75)}
      </span>
      <span class="search-label">Search...</span>
    </button>
  </div>

  <!-- Taskbar Apps List (Pinned + Running) -->
  <div class="taskbar-center">
    <!-- Pinned apps -->
    {#each PINNED_APP_IDS as appId}
      {@const manifest = APP_REGISTRY[appId]}
      {@const wins = $windowsStore.filter(w => w.appId === appId)}
      {@const isRunning = wins.length > 0}
      {@const isActive = wins.some(w => w.id === $activeWindowIdStore)}
      {#if manifest}
        <button
          class="app-btn"
          class:running={isRunning}
          class:active={isActive}
          onclick={(e) => {
            e.stopPropagation();
            handleAppClick(appId);
          }}
          title={manifest.name}
        >
          <span class="app-icon">
            {@html getIconSvg(manifest.icon, 1.75)}
          </span>
          {#if isRunning}
            <span class="run-indicator" class:focused={isActive}></span>
          {/if}
        </button>
      {/if}
    {/each}

    <!-- Running unpinned apps -->
    {#each $windowsStore as win (win.id)}
      {#if !PINNED_APP_IDS.includes(win.appId)}
        <button
          class="app-btn running"
          class:active={win.id === $activeWindowIdStore}
          onclick={(e) => {
            e.stopPropagation();
            if (win.minimized) wmManager.restore(win.id);
            else if (win.id === $activeWindowIdStore) wmManager.minimize(win.id);
            else wmManager.focus(win.id);
          }}
          title={win.title}
        >
          <span class="app-icon">
            {@html getIconSvg(win.icon, 1.75)}
          </span>
          <span class="run-indicator" class:focused={win.id === $activeWindowIdStore}></span>
        </button>
      {/if}
    {/each}
  </div>

  <!-- System Tray -->
  <div class="taskbar-right">
    <!-- Battery Widget (Hidden if not available) -->
    {#if batteryInfo && batteryInfo.present}
      <div class="tray-item battery-widget" title={`Battery: ${batteryInfo.percent}% ${batteryInfo.charging ? '(Charging)' : ''}`}>
        <span class="tray-icon">
          {@html getIconSvg(batteryInfo.charging ? 'batt-charging' : 'batt', 1.75)}
        </span>
        <span class="battery-text">{batteryInfo.percent}%</span>
      </div>
    {/if}

    <!-- Volume -->
    <button 
      class="tray-item tray-btn" 
      onclick={(e) => {
        e.stopPropagation();
        isMuted = !isMuted;
      }}
      title={isMuted ? 'Muted' : 'Volume 100%'}
    >
      <span class="tray-icon">
        {@html getIconSvg(isMuted ? 'vol-mute' : 'vol', 1.75)}
      </span>
    </button>

    <!-- Quick Settings Control Center Toggle -->
    <button 
      class="tray-item tray-btn" 
      class:active={quickSettingsOpen}
      onclick={(e) => {
        e.stopPropagation();
        ontoggleQuickSettings();
      }}
      title="Quick Settings"
    >
      <span class="tray-icon">
        {@html getIconSvg('settings', 1.75)}
      </span>
    </button>

    <!-- Clock & Date -->
    <button 
      class="tray-item tray-btn clock-widget"
      onclick={(e) => {
        e.stopPropagation();
        launchApp('clock');
      }}
      title="Open Clock / Calendar"
    >
      <span class="clock-time">{timeStr}</span>
      <span class="clock-date">{dateStr}</span>
    </button>

    <!-- Show Desktop Peek Button -->
    <button 
      class="show-desktop-btn" 
      onclick={(e) => {
        e.stopPropagation();
        toggleShowDesktop();
      }}
      title="Show Desktop"
    ></button>
  </div>
</footer>

<style>
  .taskbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 46px;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
    z-index: 1000;
    box-sizing: border-box;
    user-select: none;
    backdrop-filter: blur(16px);
  }

  .taskbar-left, .taskbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
  }

  .taskbar-center {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    flex: 1;
    justify-content: center;
    overflow-x: auto;
  }

  .start-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-primary);
    padding: 4px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    height: 36px;
  }

  .start-btn:hover, .start-btn.active {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .start-icon {
    width: 22px;
    height: 22px;
    color: var(--accent-primary);
    display: flex;
    align-items: center;
  }

  .start-icon :global(svg) {
    width: 22px;
    height: 22px;
  }

  .taskbar-search-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    height: 32px;
  }

  .taskbar-search-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .search-icon {
    width: 14px;
    height: 14px;
    display: flex;
  }

  .search-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  /* App Buttons */
  .app-btn {
    width: 40px;
    height: 38px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    color: var(--text-secondary);
    transition: background 0.15s;
  }

  .app-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .app-btn.active {
    background: var(--accent-surface);
    color: var(--accent-primary);
  }

  .app-icon {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-icon :global(svg) {
    width: 22px;
    height: 22px;
  }

  .run-indicator {
    position: absolute;
    bottom: 2px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .run-indicator.focused {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent-primary);
  }

  /* Tray */
  .tray-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    height: 34px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 12px;
  }

  .tray-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .tray-btn:hover, .tray-btn.active {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .tray-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
  }

  .tray-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .battery-widget {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .clock-widget {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    line-height: 1.1;
    padding: 2px 8px;
  }

  .clock-time {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .clock-date {
    font-size: 10px;
    color: var(--text-muted);
  }

  .show-desktop-btn {
    width: 6px;
    height: 32px;
    border: none;
    border-left: 1px solid var(--border-color);
    background: transparent;
    cursor: pointer;
    margin-left: 4px;
  }

  .show-desktop-btn:hover {
    background: var(--accent-primary);
  }
</style>
