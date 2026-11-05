<script lang="ts">
  import { onMount } from 'svelte';
  import DesktopIcon from './DesktopIcon.svelte';
  import { launchApp } from '../core/registry/appRegistry';
  import { contextMenuStore } from '../core/contextmenu/store';
  import { api } from '../core/api/client';
  import { notifications } from '../core/notifications/store';

  interface DesktopShortcut {
    id: string;
    appId: string;
    title: string;
    icon: string;
    args?: any;
  }

  const DEFAULT_SHORTCUTS: DesktopShortcut[] = [
    { id: 'sc-home', appId: 'files', title: 'Home', icon: 'home' },
    { id: 'sc-editor', appId: 'editor', title: 'Text Editor', icon: 'editor' },
    { id: 'sc-ai', appId: 'ai', title: 'Saturn AI', icon: 'ai' },
    { id: 'sc-terminal', appId: 'terminal', title: 'Terminal', icon: 'terminal' },
    { id: 'sc-browser', appId: 'browser', title: 'Web Browser', icon: 'browser' },
    { id: 'sc-monitor', appId: 'monitor', title: 'System Monitor', icon: 'monitor' },
    { id: 'sc-settings', appId: 'settings', title: 'Settings', icon: 'settings' },
    { id: 'sc-calc', appId: 'calc', title: 'Calculator', icon: 'calc' },
    { id: 'sc-clock', appId: 'clock', title: 'Clock', icon: 'clock' },
    { id: 'sc-calendar', appId: 'calendar', title: 'Calendar', icon: 'calendar' },
    { id: 'sc-trash', appId: 'files', title: 'Trash', icon: 'trash', args: { initialPath: '~/.local/share/Trash/files' } }
  ];

  let selectedId = $state<string | null>(null);

  // Rubberband selection
  let isSelecting = $state(false);
  let selStart = { x: 0, y: 0 };
  let selCurrent = $state({ x: 0, y: 0 });

  let selBox = $derived.by(() => {
    if (!isSelecting) return null;
    const left = Math.min(selStart.x, selCurrent.x);
    const top = Math.min(selStart.y, selCurrent.y);
    const width = Math.abs(selStart.x - selCurrent.x);
    const height = Math.abs(selStart.y - selCurrent.y);
    return { left, top, width, height };
  });

  function handleDesktopMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    // Clicked background
    selectedId = null;
    contextMenuStore.close();

    isSelecting = true;
    selStart = { x: e.clientX, y: e.clientY };
    selCurrent = { x: e.clientX, y: e.clientY };

    const onMouseMove = (ev: MouseEvent) => {
      selCurrent = { x: ev.clientX, y: ev.clientY };
    };

    const onMouseUp = () => {
      isSelecting = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuStore.open(e.clientX, e.clientY, [
      {
        label: 'New Folder',
        icon: 'folder',
        action: async () => {
          const name = 'New Folder';
          await api.fsMkdir(`~/Desktop/${name}`);
          notifications.add({ title: 'Desktop', message: `Created "${name}"`, type: 'info' });
        }
      },
      {
        label: 'New Text Document',
        icon: 'file',
        action: async () => {
          const name = 'untitled.txt';
          await api.fsWrite(`~/Desktop/${name}`, '');
          launchApp('editor', { initialFile: `~/Desktop/${name}` });
        }
      },
      { separator: true },
      {
        label: 'Open Terminal',
        icon: 'terminal',
        action: () => launchApp('terminal')
      },
      { separator: true },
      {
        label: 'Change Wallpaper',
        icon: 'theme',
        action: () => launchApp('settings')
      },
      {
        label: 'Display Settings',
        icon: 'settings',
        action: () => launchApp('settings')
      }
    ]);
  }

  function handleIconContextMenu(sc: DesktopShortcut, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = sc.id;
    contextMenuStore.open(e.clientX, e.clientY, [
      {
        label: 'Open',
        icon: sc.icon,
        action: () => launchApp(sc.appId, sc.args)
      },
      { separator: true },
      {
        label: 'Properties',
        icon: 'settings',
        action: () => {
          notifications.add({ title: sc.title, message: `Application shortcut (${sc.appId})`, type: 'info' });
        }
      }
    ]);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="desktop-container" 
  onmousedown={handleDesktopMouseDown}
  oncontextmenu={handleContextMenu}
>
  <div class="desktop-grid">
    {#each DEFAULT_SHORTCUTS as sc (sc.id)}
      <DesktopIcon
        title={sc.title}
        icon={sc.icon}
        selected={selectedId === sc.id}
        onselect={() => selectedId = sc.id}
        onlaunch={() => launchApp(sc.appId, sc.args)}
        oncontextmenu={(e) => handleIconContextMenu(sc, e)}
      />
    {/each}
  </div>

  {#if isSelecting && selBox && (selBox.width > 3 || selBox.height > 3)}
    <div 
      class="selection-box"
      style={`left: ${selBox.left}px; top: ${selBox.top}px; width: ${selBox.width}px; height: ${selBox.height}px;`}
    ></div>
  {/if}
</div>

<style>
  .desktop-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 46px; /* Taskbar height */
    overflow: hidden;
    z-index: 10;
  }

  .desktop-grid {
    padding: 16px;
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(auto-fill, 92px);
    grid-auto-columns: 86px;
    gap: 8px 12px;
    height: 100%;
    box-sizing: border-box;
    align-content: flex-start;
  }

  .selection-box {
    position: fixed;
    background: var(--accent-surface);
    border: 1px solid var(--accent-primary);
    border-radius: 2px;
    pointer-events: none;
    z-index: 50;
  }
</style>
