'use strict';

/**
 * Saturn OS - Pure DOM Window Manager
 * Snapping, 8-handle resizing, dragging, focus, Alt+Tab, and keyboard shortcuts.
 */
window.SaturnWM = (function () {
  const TASKBAR_HEIGHT = 46;
  let windows = [];
  let zIndexCounter = 100;
  let activeWindow = null;
  let altTabActive = false;
  let altTabIndex = 0;
  let altTabList = [];

  const snapPreviewEl = document.getElementById('snap-preview');
  const altTabOverlayEl = document.getElementById('alt-tab-overlay');

  function getAvailableHeight() {
    return window.innerHeight - TASKBAR_HEIGHT;
  }

  function createWindow(options) {
    const {
      id = 'win_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      appId,
      title = 'Application',
      icon = 'file',
      width = 720,
      height = 480,
      minWidth = 320,
      minHeight = 200,
      singleInstance = false,
      contentRenderer = null,
      arg = null
    } = options;

    // Check single instance
    if (singleInstance) {
      const existing = windows.find(w => w.appId === appId);
      if (existing) {
        if (existing.minimized) restoreWindow(existing);
        focusWindow(existing);
        if (existing.onArg) existing.onArg(arg);
        return existing;
      }
    }

    const el = document.createElement('div');
    el.className = 'win opening';
    el.id = id;

    // Stagger window positions
    const staggerIndex = windows.length % 7;
    const initialLeft = Math.max(20, Math.min(window.innerWidth - width - 40, 80 + staggerIndex * 30));
    const initialTop = Math.max(10, Math.min(getAvailableHeight() - height - 30, 40 + staggerIndex * 26));

    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.left = initialLeft + 'px';
    el.style.top = initialTop + 'px';
    el.style.zIndex = ++zIndexCounter;

    el.innerHTML = `
      <div class="win-titlebar">
        <span class="win-icon">${window.SaturnIcons.svg(icon)}</span>
        <span class="win-title">${title}</span>
        <div class="win-controls">
          <button class="btn-min" data-action="minimize" title="Minimize">${window.SaturnIcons.svg('min')}</button>
          <button class="btn-max" data-action="maximize" title="Maximize">${window.SaturnIcons.svg('max')}</button>
          <button class="btn-close" data-action="close" title="Close">${window.SaturnIcons.svg('close')}</button>
        </div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize-handle" data-edge="n"></div>
      <div class="win-resize-handle" data-edge="s"></div>
      <div class="win-resize-handle" data-edge="e"></div>
      <div class="win-resize-handle" data-edge="w"></div>
      <div class="win-resize-handle" data-edge="ne"></div>
      <div class="win-resize-handle" data-edge="nw"></div>
      <div class="win-resize-handle" data-edge="se"></div>
      <div class="win-resize-handle" data-edge="sw"></div>
    `;

    const bodyEl = el.querySelector('.win-body');

    const winObj = {
      id,
      appId,
      title,
      icon,
      el,
      bodyEl,
      minWidth,
      minHeight,
      minimized: false,
      maximized: false,
      snapSide: null,
      prevBounds: { left: initialLeft, top: initialTop, width, height },
      onClose: null,
      onArg: null
    };

    el._win = winObj;
    document.body.appendChild(el);
    windows.push(winObj);

    // Initial animation cleanup
    requestAnimationFrame(() => {
      el.classList.remove('opening');
    });

    // Render content
    if (typeof contentRenderer === 'function') {
      contentRenderer(winObj, arg);
    }

    focusWindow(winObj);
    updateTaskbar();
    return winObj;
  }

  function focusWindow(win) {
    if (!win || !win.el) return;
    if (win.minimized) {
      restoreWindow(win);
    }
    zIndexCounter += 2;
    win.el.style.zIndex = zIndexCounter;
    activeWindow = win;

    windows.forEach(w => {
      const isFocused = (w === win);
      w.el.classList.toggle('inactive', !isFocused);
    });

    updateTaskbar();
  }

  function minimizeWindow(win) {
    if (!win) return;
    win.minimized = true;
    win.el.classList.add('minimized');

    // Switch focus to highest z-index visible window
    const visibleWins = windows
      .filter(w => !w.minimized)
      .sort((a, b) => parseInt(b.el.style.zIndex || 0, 10) - parseInt(a.el.style.zIndex || 0, 10));

    if (visibleWins.length > 0) {
      focusWindow(visibleWins[0]);
    } else {
      activeWindow = null;
    }
    updateTaskbar();
  }

  function restoreWindow(win) {
    if (!win) return;
    win.minimized = false;
    win.el.classList.remove('minimized');
    focusWindow(win);
  }

  function maximizeWindow(win) {
    if (!win) return;
    const btnMax = win.el.querySelector('.btn-max');
    if (win.maximized) {
      // Restore
      win.maximized = false;
      win.snapSide = null;
      win.el.classList.remove('maximized');
      win.el.style.left = win.prevBounds.left + 'px';
      win.el.style.top = win.prevBounds.top + 'px';
      win.el.style.width = win.prevBounds.width + 'px';
      win.el.style.height = win.prevBounds.height + 'px';
      if (btnMax) btnMax.innerHTML = window.SaturnIcons.svg('max');
    } else {
      // Maximize
      win.prevBounds = {
        left: win.el.offsetLeft,
        top: win.el.offsetTop,
        width: win.el.offsetWidth,
        height: win.el.offsetHeight
      };
      win.maximized = true;
      win.snapSide = null;
      win.el.classList.add('maximized');
      win.el.style.left = '0px';
      win.el.style.top = '0px';
      win.el.style.width = window.innerWidth + 'px';
      win.el.style.height = getAvailableHeight() + 'px';
      if (btnMax) btnMax.innerHTML = window.SaturnIcons.svg('restore');
    }
  }

  function snapWindow(win, side) {
    if (!win) return;
    const availH = getAvailableHeight();
    const halfW = Math.floor(window.innerWidth / 2);

    if (side === 'top') {
      maximizeWindow(win);
      return;
    }

    if (!win.maximized && !win.snapSide) {
      win.prevBounds = {
        left: win.el.offsetLeft,
        top: win.el.offsetTop,
        width: win.el.offsetWidth,
        height: win.el.offsetHeight
      };
    }

    win.maximized = false;
    win.snapSide = side;
    win.el.classList.remove('maximized');

    if (side === 'left') {
      win.el.style.left = '0px';
      win.el.style.top = '0px';
      win.el.style.width = halfW + 'px';
      win.el.style.height = availH + 'px';
    } else if (side === 'right') {
      win.el.style.left = halfW + 'px';
      win.el.style.top = '0px';
      win.el.style.width = (window.innerWidth - halfW) + 'px';
      win.el.style.height = availH + 'px';
    }
  }

  function closeWindow(win) {
    if (!win) return;
    if (typeof win.onClose === 'function') {
      try { win.onClose(); } catch (e) { console.error('Error in onClose:', e); }
    }
    win.el.classList.add('closing');
    windows = windows.filter(w => w !== win);

    setTimeout(() => {
      if (win.el && win.el.parentNode) {
        win.el.parentNode.removeChild(win.el);
      }
    }, 160);

    const remaining = windows
      .filter(w => !w.minimized)
      .sort((a, b) => parseInt(b.el.style.zIndex || 0, 10) - parseInt(a.el.style.zIndex || 0, 10));

    if (remaining.length > 0) {
      focusWindow(remaining[0]);
    } else {
      activeWindow = null;
    }
    updateTaskbar();
  }

  // Window Drag Operation
  function initDrag(e, win) {
    if (e.target.closest('.win-controls button')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    let initialLeft = rect.left;
    let initialTop = rect.top;
    let initialWidth = rect.width;
    let initialHeight = rect.height;

    // If maximized, restore on drag
    if (win.maximized || win.snapSide) {
      const prev = win.prevBounds || { width: 700, height: 480 };
      const ratio = startX / window.innerWidth;
      initialLeft = Math.max(0, startX - prev.width * ratio);
      initialTop = Math.max(0, startY - 14);
      initialWidth = prev.width;
      initialHeight = prev.height;

      win.maximized = false;
      win.snapSide = null;
      win.el.classList.remove('maximized');
      win.el.style.width = initialWidth + 'px';
      win.el.style.height = initialHeight + 'px';
      win.el.style.left = initialLeft + 'px';
      win.el.style.top = initialTop + 'px';
      const btnMax = win.el.querySelector('.btn-max');
      if (btnMax) btnMax.innerHTML = window.SaturnIcons.svg('max');
    }

    let snapTarget = null;

    function onPointerMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let nextX = initialLeft + dx;
      let nextY = initialTop + dy;

      // Bound Y to screen
      nextY = Math.max(0, Math.min(getAvailableHeight() - 30, nextY));

      win.el.style.left = nextX + 'px';
      win.el.style.top = nextY + 'px';

      // Snap Detection
      const curX = ev.clientX;
      const curY = ev.clientY;
      const availH = getAvailableHeight();
      const halfW = Math.floor(window.innerWidth / 2);

      if (curY < 8) {
        snapTarget = 'top';
        showSnapPreview(0, 0, window.innerWidth, availH);
      } else if (curX < 12) {
        snapTarget = 'left';
        showSnapPreview(0, 0, halfW, availH);
      } else if (curX > window.innerWidth - 12) {
        snapTarget = 'right';
        showSnapPreview(halfW, 0, halfW, availH);
      } else {
        snapTarget = null;
        hideSnapPreview();
      }
    }

    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      hideSnapPreview();

      if (snapTarget) {
        snapWindow(win, snapTarget);
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // Window Resize Operation
  function initResize(e, win, edge) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    const origLeft = rect.left;
    const origTop = rect.top;
    const origWidth = rect.width;
    const origHeight = rect.height;

    function onPointerMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = origWidth;
      let newH = origHeight;
      let newL = origLeft;
      let newT = origTop;

      if (edge.includes('e')) newW = Math.max(win.minWidth, origWidth + dx);
      if (edge.includes('s')) newH = Math.max(win.minHeight, origHeight + dy);
      if (edge.includes('w')) {
        newW = Math.max(win.minWidth, origWidth - dx);
        newL = origLeft + (origWidth - newW);
      }
      if (edge.includes('n')) {
        newH = Math.max(win.minHeight, origHeight - dy);
        newT = origTop + (origHeight - newH);
      }

      win.el.style.width = newW + 'px';
      win.el.style.height = newH + 'px';
      win.el.style.left = newL + 'px';
      win.el.style.top = newT + 'px';
      win.maximized = false;
      win.snapSide = null;
      win.el.classList.remove('maximized');
    }

    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function showSnapPreview(x, y, w, h) {
    if (!snapPreviewEl) return;
    snapPreviewEl.style.left = x + 'px';
    snapPreviewEl.style.top = y + 'px';
    snapPreviewEl.style.width = w + 'px';
    snapPreviewEl.style.height = h + 'px';
    snapPreviewEl.style.display = 'block';
  }

  function hideSnapPreview() {
    if (!snapPreviewEl) return;
    snapPreviewEl.style.display = 'none';
  }

  // Global event delegation for window interactions
  document.addEventListener('pointerdown', e => {
    const winEl = e.target.closest('.win');
    if (winEl && winEl._win) {
      focusWindow(winEl._win);
    }

    // Resize handle
    const resizeHandle = e.target.closest('.win-resize-handle');
    if (resizeHandle && winEl && winEl._win) {
      initResize(e, winEl._win, resizeHandle.dataset.edge);
      return;
    }

    // Titlebar drag
    const titlebar = e.target.closest('.win-titlebar');
    if (titlebar && winEl && winEl._win) {
      initDrag(e, winEl._win);
    }
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.win-controls button');
    if (!btn) return;
    const winEl = btn.closest('.win');
    if (!winEl || !winEl._win) return;
    const win = winEl._win;
    const action = btn.dataset.action;

    if (action === 'close') closeWindow(win);
    else if (action === 'minimize') minimizeWindow(win);
    else if (action === 'maximize') maximizeWindow(win);
  });

  document.addEventListener('dblclick', e => {
    const titlebar = e.target.closest('.win-titlebar');
    if (titlebar && !e.target.closest('.win-controls button')) {
      const winEl = titlebar.closest('.win');
      if (winEl && winEl._win) {
        maximizeWindow(winEl._win);
      }
    }
  });

  // Handle Window Resizing (display resize / orientation)
  window.addEventListener('resize', () => {
    const availH = getAvailableHeight();
    windows.forEach(w => {
      if (w.maximized) {
        w.el.style.width = window.innerWidth + 'px';
        w.el.style.height = availH + 'px';
      } else if (w.snapSide === 'left') {
        const halfW = Math.floor(window.innerWidth / 2);
        w.el.style.width = halfW + 'px';
        w.el.style.height = availH + 'px';
      } else if (w.snapSide === 'right') {
        const halfW = Math.floor(window.innerWidth / 2);
        w.el.style.left = halfW + 'px';
        w.el.style.width = (window.innerWidth - halfW) + 'px';
        w.el.style.height = availH + 'px';
      }
    });
  });

  // Keyboard Shortcuts (Alt+F4, Super+Arrows, Ctrl+Alt+Arrows, Alt+Tab)
  document.addEventListener('keydown', e => {
    // If lock screen active, ignore window manager keys
    if (document.getElementById('lock-screen')?.classList.contains('active')) return;

    // Alt+F4 Close active
    if (e.altKey && e.key === 'F4') {
      if (activeWindow) {
        e.preventDefault();
        closeWindow(activeWindow);
        return;
      }
    }

    // Window snapping keyboard shortcuts: Super+Arrows or Ctrl+Alt+Arrows
    const isSnapMod = (e.metaKey || (e.ctrlKey && e.altKey));
    if (isSnapMod && activeWindow) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        snapWindow(activeWindow, 'left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        snapWindow(activeWindow, 'right');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!activeWindow.maximized) maximizeWindow(activeWindow);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeWindow.maximized || activeWindow.snapSide) {
          maximizeWindow(activeWindow);
        } else {
          minimizeWindow(activeWindow);
        }
        return;
      }
    }

    // Alt+Tab Switcher
    if (e.altKey && e.key === 'Tab') {
      e.preventDefault();
      if (!altTabActive) {
        altTabList = windows.slice().sort((a, b) => parseInt(b.el.style.zIndex || 0, 10) - parseInt(a.el.style.zIndex || 0, 10));
        if (altTabList.length < 2) return;
        altTabActive = true;
        altTabIndex = 0;
      }
      const dir = e.shiftKey ? -1 : 1;
      altTabIndex = (altTabIndex + dir + altTabList.length) % altTabList.length;
      renderAltTab();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'Alt' && altTabActive) {
      altTabActive = false;
      if (altTabOverlayEl) altTabOverlayEl.style.display = 'none';
      if (altTabList[altTabIndex]) {
        restoreWindow(altTabList[altTabIndex]);
        focusWindow(altTabList[altTabIndex]);
      }
    }
  });

  function renderAltTab() {
    if (!altTabOverlayEl) return;
    altTabOverlayEl.style.display = 'flex';
    altTabOverlayEl.innerHTML = altTabList.map((w, idx) => {
      const isSel = idx === altTabIndex;
      return `
        <div class="alt-tab-item ${isSel ? 'selected' : ''}">
          <div class="icon-badge">${window.SaturnIcons.svg(w.icon)}</div>
          <span class="title">${w.title}</span>
        </div>
      `;
    }).join('');
  }

  function updateTaskbar() {
    if (window.SaturnShell && typeof window.SaturnShell.updateTaskbar === 'function') {
      window.SaturnShell.updateTaskbar();
    }
  }

  return {
    createWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    snapWindow,
    closeWindow,
    getActiveWindow: () => activeWindow,
    getAllWindows: () => windows,
    getWindowsByAppId: appId => windows.filter(w => w.appId === appId)
  };
})();
