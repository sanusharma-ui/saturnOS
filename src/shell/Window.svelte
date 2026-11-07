<script lang="ts">
  import { getIconSvg } from '../assets/icons/icons';
  import type { WindowInstance } from '../core/wm/types';
  import { wmManager } from '../core/wm/manager';
  import { getAppManifest } from '../core/registry/appRegistry';

  interface Props {
    win: WindowInstance;
    active: boolean;
  }

  let { win, active }: Props = $props();

  let manifest = $derived(getAppManifest(win.appId));

  // Dragging logic
  let isDragging = false;
  let dragStart = { x: 0, y: 0, winX: 0, winY: 0 };
  let pendingSnap: 'left' | 'right' | 'top' | null = null;

  function onTitleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.win-ctrl-btn')) return;

    wmManager.focus(win.id);
    if (win.maximized) return; // don't drag if maximized unless restored

    isDragging = true;
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      winX: win.x,
      winY: win.y
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging) return;
      const dx = ev.clientX - dragStart.x;
      const dy = ev.clientY - dragStart.y;
      const newX = Math.max(-win.width + 100, Math.min(window.innerWidth - 100, dragStart.winX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 80, dragStart.winY + dy));

      wmManager.updateWindowBounds(win.id, { x: newX, y: newY });

      // Edge snapping detection
      const availH = window.innerHeight - 46;
      const halfW = Math.floor(window.innerWidth / 2);

      if (ev.clientY <= 8) {
        pendingSnap = 'top';
        wmManager.showSnapPreview(0, 0, window.innerWidth, availH);
      } else if (ev.clientX <= 8) {
        pendingSnap = 'left';
        wmManager.showSnapPreview(0, 0, halfW, availH);
      } else if (ev.clientX >= window.innerWidth - 8) {
        pendingSnap = 'right';
        wmManager.showSnapPreview(halfW, 0, halfW, availH);
      } else {
        pendingSnap = null;
        wmManager.hideSnapPreview();
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      wmManager.hideSnapPreview();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (pendingSnap === 'top') {
        wmManager.maximize(win.id);
      } else if (pendingSnap === 'left' || pendingSnap === 'right') {
        wmManager.snap(win.id, pendingSnap);
      }
      pendingSnap = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleTitleDblClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.win-ctrl-btn')) return;
    wmManager.maximize(win.id);
  }

  // 8-Handle Resizing
  function startResize(e: MouseEvent, direction: string) {
    if (e.button !== 0 || win.maximized) return;
    e.stopPropagation();
    e.preventDefault();
    wmManager.focus(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = win.width;
    const startH = win.height;
    const startPosX = win.x;
    const startPosY = win.y;
    const minW = win.minWidth;
    const minH = win.minHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW;
      let newH = startH;
      let newX = startPosX;
      let newY = startPosY;

      if (direction.includes('e')) {
        newW = Math.max(minW, startW + dx);
      }
      if (direction.includes('s')) {
        newH = Math.max(minH, startH + dy);
      }
      if (direction.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= minW) {
          newW = potentialW;
          newX = startPosX + dx;
        }
      }
      if (direction.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= minH) {
          newH = potentialH;
          newY = startPosY + dy;
        }
      }

      wmManager.updateWindowBounds(win.id, { x: newX, y: newY, width: newW, height: newH });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="window-frame"
  class:active
  class:maximized={win.maximized}
  class:minimized={win.minimized}
  style={`left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px; z-index: ${win.zIndex};`}
  onmousedown={() => wmManager.focus(win.id)}
>
  <!-- Titlebar -->
  <header 
    class="window-titlebar"
    onmousedown={onTitleMouseDown}
    ondblclick={handleTitleDblClick}
  >
    <div class="titlebar-left">
      <span class="win-icon">
        {@html getIconSvg(win.icon, 1.75)}
      </span>
      <span class="win-title">{win.title}</span>
    </div>

    <div class="titlebar-controls">
      <button 
        class="win-ctrl-btn btn-min" 
        onclick={() => wmManager.minimize(win.id)}
        title="Minimize"
      >
        {@html getIconSvg('min', 1.75)}
      </button>

      <button 
        class="win-ctrl-btn btn-max" 
        onclick={() => wmManager.maximize(win.id)}
        title={win.maximized ? 'Restore' : 'Maximize'}
      >
        {@html getIconSvg(win.maximized ? 'restore' : 'max', 1.75)}
      </button>

      <button 
        class="win-ctrl-btn btn-close" 
        onclick={() => wmManager.close(win.id)}
        title="Close"
      >
        {@html getIconSvg('close', 1.75)}
      </button>
    </div>
  </header>

  <!-- Window Body Content -->
  <div class="window-content">
    {#if manifest?.component}
      {@const AppComp = manifest.component}
      {@const props = (typeof win.arg === 'object' && win.arg !== null) ? win.arg : { arg: win.arg }}
      <AppComp {...props} arg={props.arg ?? props.initialPath ?? props.initialFile ?? props.filePath} />
    {:else}
      <div class="empty-win-msg">No component found for {win.appId}</div>
    {/if}
  </div>

  <!-- 8 Resize Handles (only active when not maximized) -->
  {#if !win.maximized}
    <div class="handle handle-n" onmousedown={(e) => startResize(e, 'n')}></div>
    <div class="handle handle-s" onmousedown={(e) => startResize(e, 's')}></div>
    <div class="handle handle-e" onmousedown={(e) => startResize(e, 'e')}></div>
    <div class="handle handle-w" onmousedown={(e) => startResize(e, 'w')}></div>
    <div class="handle handle-ne" onmousedown={(e) => startResize(e, 'ne')}></div>
    <div class="handle handle-nw" onmousedown={(e) => startResize(e, 'nw')}></div>
    <div class="handle handle-se" onmousedown={(e) => startResize(e, 'se')}></div>
    <div class="handle handle-sw" onmousedown={(e) => startResize(e, 'sw')}></div>
  {/if}
</div>

<style>
  .window-frame {
    position: absolute;
    display: flex;
    flex-direction: column;
    background: var(--bg-window);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    box-sizing: border-box;
    transition: box-shadow 0.15s;
  }

  .window-frame.active {
    border-color: var(--border-active);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6);
  }

  .window-frame.maximized {
    border-radius: 0;
    border: none;
  }

  .window-frame.minimized {
    display: none;
  }

  /* Titlebar */
  .window-titlebar {
    height: 36px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 12px;
    user-select: none;
    cursor: default;
  }

  .titlebar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    pointer-events: none;
  }

  .win-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    color: var(--accent-primary);
  }

  .win-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .win-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .titlebar-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .win-ctrl-btn {
    width: 28px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .win-ctrl-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .win-ctrl-btn.btn-close:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .win-ctrl-btn :global(svg) {
    width: 14px;
    height: 14px;
  }

  /* Content */
  .window-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: var(--bg-window);
  }

  .empty-win-msg {
    padding: 24px;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* 8 Resize Handles */
  .handle {
    position: absolute;
    z-index: 100;
  }

  .handle-n { top: 0; left: 6px; right: 6px; height: 5px; cursor: n-resize; }
  .handle-s { bottom: 0; left: 6px; right: 6px; height: 5px; cursor: s-resize; }
  .handle-e { top: 6px; bottom: 6px; right: 0; width: 5px; cursor: e-resize; }
  .handle-w { top: 6px; bottom: 6px; left: 0; width: 5px; cursor: w-resize; }

  .handle-ne { top: 0; right: 0; width: 8px; height: 8px; cursor: ne-resize; }
  .handle-nw { top: 0; left: 0; width: 8px; height: 8px; cursor: nw-resize; }
  .handle-se { bottom: 0; right: 0; width: 8px; height: 8px; cursor: se-resize; }
  .handle-sw { bottom: 0; left: 0; width: 8px; height: 8px; cursor: sw-resize; }
</style>
