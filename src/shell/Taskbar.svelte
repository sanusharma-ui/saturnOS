<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getIconSvg } from '../assets/icons/icons';
  import { windowsStore, activeWindowIdStore } from '../core/wm/store';
  import { wmManager } from '../core/wm/manager';
  import { APP_REGISTRY, launchApp } from '../core/registry/appRegistry';
  import { contextMenuStore } from '../core/contextmenu/store';
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

  // Pinned App Quick-Launchers
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

  // Handle click on an open window tab
  function handleWindowTabClick(win: WindowInstance) {
    if (win.minimized) {
      wmManager.restore(win.id);
      wmManager.focus(win.id);
    } else if (win.id === $activeWindowIdStore) {
      wmManager.minimize(win.id);
    } else {
      wmManager.focus(win.id);
    }
  }

  // Handle right click on an open window tab
  function handleWindowTabContextMenu(e: MouseEvent, win: WindowInstance) {
    e.preventDefault();
    e.stopPropagation();

    contextMenuStore.open(e.clientX, e.clientY, [
      {
        label: win.minimized ? 'Restore' : 'Bring to Front',
        icon: win.icon,
        action: () => {
          if (win.minimized) wmManager.restore(win.id);
          wmManager.focus(win.id);
        }
      },
      {
        label: win.minimized ? 'Restore' : 'Minimize',
        icon: 'up',
        action: () => {
          if (win.minimized) wmManager.restore(win.id);
          else wmManager.minimize(win.id);
        }
      },
      {
        label: win.maximized ? 'Restore Window' : 'Maximize',
        icon: 'grid',
        action: () => wmManager.maximize(win.id)
      },
      { separator: true },
      {
        label: 'Close Window',
        icon: 'close',
        shortcut: 'Alt+F4',
        danger: true,
        action: () => wmManager.close(win.id)
      }
    ]);
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
  <!-- Left Side: Start + Search + Pinned Quick Launch -->
  <div class="taskbar-left">
    <!-- Start Button -->
    <button 
      type="button"
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
      type="button"
      class="taskbar-search-btn"
      onclick={(e) => {
        e.stopPropagation();
        onOpenSearch();
      }}
      title="Search apps and files (Ctrl+Space)"
    >
      <span class="search-icon">
        {@html getIconSvg('search', 1.5)}
      </span>
      <span class="search-label">Search</span>
    </button>

    <!-- Divider -->
    <div class="taskbar-v-sep"></div>

    <!-- Pinned Quick Launch Icons -->
    <div class="pinned-quick-launch">
      {#each PINNED_APP_IDS as appId}
        {@const manifest = APP_REGISTRY[appId]}
        {#if manifest}
          <button
            type="button"
            class="pinned-btn"
            onclick={(e) => {
              e.stopPropagation();
              launchApp(appId);
            }}
            title={`Launch ${manifest.name}`}
          >
            <span class="pinned-icon">
              {@html getIconSvg(manifest.icon, 1.4)}
            </span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- Divider -->
    <div class="taskbar-v-sep"></div>
  </div>

  <!-- Center Area: OPEN RUNNING APPLICATIONS (Real PC Taskbar) -->
  <div class="taskbar-open-apps">
    {#if $windowsStore.length === 0}
      <span class="no-windows-hint">No open windows</span>
    {:else}
      {#each $windowsStore as win (win.id)}
        {@const isActive = win.id === $activeWindowIdStore && !win.minimized}
        <div
          class="open-win-tab"
          class:active={isActive}
          class:minimized={win.minimized}
          role="button"
          tabindex="0"
          onclick={() => handleWindowTabClick(win)}
          oncontextmenu={(e) => handleWindowTabContextMenu(e, win)}
          onkeydown={(e) => { if (e.key === 'Enter') handleWindowTabClick(win); }}
          title={win.title}
        >
          <span class="win-tab-icon">
            {@html getIconSvg(win.icon, 1.35)}
          </span>
          <span class="win-tab-title">{win.title}</span>
          <button
            type="button"
            class="win-tab-close"
            onclick={(e) => {
              e.stopPropagation();
              wmManager.close(win.id);
            }}
            title="Close Window"
          >×</button>
          <div class="win-tab-indicator" class:focused={isActive}></div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Right Side: System Tray -->
  <div class="taskbar-right">
    <!-- Battery Widget -->
    {#if batteryInfo && batteryInfo.present}
      <div class="tray-item battery-widget" title={`Battery: ${batteryInfo.percent}% ${batteryInfo.charging ? '(Charging)' : ''}`}>
        <span class="tray-icon">
          {@html getIconSvg(batteryInfo.charging ? 'batt-charging' : 'batt', 1.5)}
        </span>
        <span class="battery-text">{batteryInfo.percent}%</span>
      </div>
    {/if}

    <!-- Volume -->
    <button 
      type="button"
      class="tray-item tray-btn" 
      onclick={(e) => {
        e.stopPropagation();
        isMuted = !isMuted;
      }}
      title={isMuted ? 'Muted' : 'Volume 100%'}
    >
      <span class="tray-icon">
        {@html getIconSvg(isMuted ? 'vol-mute' : 'vol', 1.5)}
      </span>
    </button>

    <!-- Quick Settings Control Center Toggle -->
    <button 
      type="button"
      class="tray-item tray-btn" 
      class:active={quickSettingsOpen}
      onclick={(e) => {
        e.stopPropagation();
        ontoggleQuickSettings();
      }}
      title="Quick Settings"
    >
      <span class="tray-icon">
        {@html getIconSvg('settings', 1.5)}
      </span>
    </button>

    <!-- Clock & Date -->
    <button 
      type="button"
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
      type="button"
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
    background: var(--bg-surface, #181a20);
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    padding: 0 4px;
    z-index: 1000;
    box-sizing: border-box;
    user-select: none;
    backdrop-filter: blur(16px);
    gap: 8px;
  }

  .taskbar-left, .taskbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    flex: none;
  }

  .start-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-primary, #ffffff);
    padding: 4px 10px;
    border-radius: var(--radius-sm, 6px);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    height: 36px;
  }

  .start-btn:hover, .start-btn.active {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--border-color, rgba(255, 255, 255, 0.12));
  }

  .start-icon {
    width: 20px;
    height: 20px;
    color: var(--accent-primary, #3b82f6);
    display: flex;
    align-items: center;
  }

  .start-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .taskbar-search-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-card, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-muted, #94a3b8);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    height: 32px;
    transition: all 0.15s;
  }

  .taskbar-search-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: #ffffff;
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

  .taskbar-v-sep {
    width: 1px;
    height: 22px;
    background: var(--border-color, rgba(255, 255, 255, 0.1));
    margin: 0 2px;
  }

  /* Pinned Quick Launch */
  .pinned-quick-launch {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .pinned-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--text-secondary, #94a3b8);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .pinned-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: #ffffff;
  }

  .pinned-icon {
    width: 18px;
    height: 18px;
    display: flex;
  }

  .pinned-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  /* OPEN RUNNING APPLICATIONS SECTION */
  .taskbar-open-apps {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 4px;
  }

  .taskbar-open-apps::-webkit-scrollbar {
    height: 0px;
  }

  .no-windows-hint {
    color: var(--text-muted, #64748b);
    font-size: 11px;
    font-style: italic;
    opacity: 0.5;
  }

  /* Open Window Tab / Pill */
  .open-win-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    min-width: 120px;
    max-width: 200px;
    padding: 0 8px 0 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: var(--text-secondary, #94a3b8);
    font-size: 12px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.15s ease;
  }

  .open-win-tab:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .open-win-tab.active {
    background: rgba(59, 130, 246, 0.18);
    border-color: var(--accent-primary, #3b82f6);
    color: #ffffff;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  }

  .open-win-tab.minimized {
    opacity: 0.6;
    background: rgba(0, 0, 0, 0.2);
  }

  .open-win-tab.minimized:hover {
    opacity: 0.9;
  }

  .win-tab-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    flex: none;
  }

  .win-tab-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .win-tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .win-tab-close {
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 13px;
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    flex: none;
    line-height: 1;
    transition: opacity 0.1s, background 0.1s;
  }

  .open-win-tab:hover .win-tab-close {
    opacity: 0.6;
  }

  .win-tab-close:hover {
    opacity: 1 !important;
    background: #ef4444;
    color: #ffffff;
  }

  .win-tab-indicator {
    position: absolute;
    bottom: 0;
    left: 8px;
    right: 8px;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: rgba(255, 255, 255, 0.2);
  }

  .win-tab-indicator.focused {
    background: var(--accent-primary, #3b82f6);
    height: 3px;
    box-shadow: 0 0 6px var(--accent-primary, #3b82f6);
  }

  /* Tray */
  .tray-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    height: 34px;
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary, #94a3b8);
    font-size: 12px;
  }

  .tray-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .tray-btn:hover, .tray-btn.active {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    color: var(--text-primary, #ffffff);
  }

  .tray-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
  }

  .tray-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .battery-widget {
    font-size: 11px;
    color: var(--text-secondary, #94a3b8);
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
    color: var(--text-primary, #ffffff);
  }

  .clock-date {
    font-size: 10px;
    color: var(--text-muted, #64748b);
  }

  .show-desktop-btn {
    width: 6px;
    height: 32px;
    border: none;
    border-left: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    background: transparent;
    cursor: pointer;
    margin-left: 4px;
  }

  .show-desktop-btn:hover {
    background: var(--accent-primary, #3b82f6);
  }
</style>
