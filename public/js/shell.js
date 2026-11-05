'use strict';

/**
 * Saturn OS - Shell Core
 * Desktop, Taskbar, Launcher, Global Search, Context Menus, Toasts, Lock, and Power.
 */
window.SaturnShell = (function () {
  const HOME_DIR = '/home/sanu';
  const DESKTOP_DIR = HOME_DIR + '/Desktop';
  const TRASH_DIR = HOME_DIR + '/.saturn-trash';

  // Safe LocalStorage Helper
  const Storage = {
    get(key, fallback) {
      try {
        const val = localStorage.getItem(key);
        return val != null ? JSON.parse(val) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    }
  };

  // State Management
  const State = Object.assign(
    {
      theme: 'dark', // 'dark' | 'light'
      accent: 'blue', // 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal'
      effects: true, // boolean
      scale: 1.0, // 0.9, 1.0, 1.1, 1.25
      volume: 80,
      brightness: 100,
      customWallpaper: null, // path
      passwordHash: null,
      passwordSalt: null
    },
    Storage.get('saturn.settings', {})
  );

  let clipboard = null; // { action: 'copy' | 'cut', path: string }
  let notifications = Storage.get('saturn.notifications', []);
  let desktopPositions = Storage.get('saturn.desktop_positions', {});

  // API Request Wrapper
  async function api(endpoint, options = {}) {
    const isPost = options.method === 'POST';
    const fetchOptions = {
      method: options.method || 'GET',
      headers: isPost ? { 'Content-Type': 'application/json' } : {}
    };
    if (isPost && options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }
    const res = await fetch(endpoint, fetchOptions);
    let json = {};
    try {
      json = await res.json();
    } catch (e) {}
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  }

  // Toast Notifications
  function toast(title, message = '', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    notifications.unshift({ id: Date.now(), title, message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (notifications.length > 20) notifications.pop();
    Storage.set('saturn.notifications', notifications);

    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `
      <div class="title">${escapeHtml(title)}</div>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ''}
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.2s';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  // Modal Dialogs
  function modalDialog(html, onOk, onCancel) {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');
    if (!overlay || !box) return;

    box.innerHTML = html;
    overlay.classList.add('active');

    function close() {
      overlay.classList.remove('active');
    }

    const cancelBtn = box.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        close();
        if (onCancel) onCancel();
      };
    }

    const okBtn = box.querySelector('[data-action="ok"]');
    if (okBtn) {
      okBtn.onclick = () => {
        const input = box.querySelector('input');
        const val = input ? input.value : null;
        close();
        if (onOk) onOk(val);
      };
    }

    const input = box.querySelector('input');
    if (input) {
      input.focus();
      input.select();
      input.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (okBtn) okBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
    }
  }

  function confirmDialog(title, message, onConfirm) {
    modalDialog(`
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="actions">
        <button data-action="cancel">Cancel</button>
        <button class="btn-primary" data-action="ok">Confirm</button>
      </div>
    `, onConfirm);
  }

  function promptDialog(title, defaultValue, onOk) {
    modalDialog(`
      <h3>${escapeHtml(title)}</h3>
      <input type="text" value="${escapeHtml(defaultValue || '')}" style="width: 100%; margin: 8px 0;">
      <div class="actions">
        <button data-action="cancel">Cancel</button>
        <button class="btn-primary" data-action="ok">OK</button>
      </div>
    `, onOk);
  }

  // Settings Management
  function saveSettings() {
    Storage.set('saturn.settings', State);
  }

  function applySettings() {
    const root = document.documentElement;
    root.classList.toggle('light-theme', State.theme === 'light');
    document.body.classList.toggle('reduce-effects', !State.effects);

    const accentMap = {
      blue: '#3b82f6',
      purple: '#8b5cf6',
      green: '#22c55e',
      orange: '#f59e0b',
      red: '#ef4444',
      teal: '#14b8a6'
    };
    const color = accentMap[State.accent] || accentMap.blue;
    root.style.setProperty('--accent', color);

    // Scaling
    root.style.zoom = State.scale;

    // Wallpaper
    applyWallpaper();
    saveSettings();
  }

  function applyWallpaper() {
    const wpImg = document.getElementById('wp-image');
    if (!wpImg) return;

    if (State.customWallpaper) {
      wpImg.style.backgroundImage = `url('/api/file?path=${encodeURIComponent(State.customWallpaper)}')`;
    } else {
      wpImg.style.backgroundImage = `url('wallpaper.jpg')`;
    }

    // Test image loading; if fails or not found, CSS fallback gradient underneath remains visible
    const testImg = new Image();
    testImg.src = State.customWallpaper ? `/api/file?path=${encodeURIComponent(State.customWallpaper)}` : 'wallpaper.jpg';
    testImg.onerror = () => {
      wpImg.style.opacity = '0';
    };
    testImg.onload = () => {
      wpImg.style.opacity = '1';
    };
  }

  // Pinned Apps Configuration
  const APPS_META = {
    files: { name: 'Files', icon: 'files', colors: ['#4f8eff', '#2563eb'], pinned: true },
    editor: { name: 'Text Editor', icon: 'editor', colors: ['#6b7280', '#4b5563'], pinned: true },
    viewer: { name: 'Media Viewer', icon: 'viewer', colors: ['#c084fc', '#9333ea'], pinned: true },
    monitor: { name: 'System Monitor', icon: 'monitor', colors: ['#34d399', '#059669'], pinned: true },
    settings: { name: 'Settings', icon: 'settings', colors: ['#94a3b8', '#64748b'], pinned: true },
    calc: { name: 'Calculator', icon: 'calc', colors: ['#fbbf24', '#d97706'], pinned: true },
    calendar: { name: 'Calendar', icon: 'calendar', colors: ['#f87171', '#dc2626'], pinned: true },
    clock: { name: 'Clock & Timer', icon: 'clock', colors: ['#38bdf8', '#0284c7'], pinned: true },
    ai: { name: 'Saturn AI', icon: 'ai', colors: ['#a855f7', '#6366f1'], pinned: true },
    terminal: { name: 'Terminal', icon: 'terminal', colors: ['#334155', '#1e293b'], pinned: true, isNative: true, command: 'terminal' },
    browser: { name: 'Web Browser', icon: 'browser', colors: ['#38bdf8', '#0369a1'], pinned: true, isNative: true, command: 'browser' }
  };

  // Launch App
  function launchApp(appId, arg = null) {
    const meta = APPS_META[appId];
    if (!meta) return;

    if (meta.isNative) {
      toast(meta.name, 'Launching on display...');
      api('/api/launch', {
        method: 'POST',
        body: { app: meta.command, path: typeof arg === 'string' && arg.startsWith('/') ? arg : undefined }
      }).catch(err => {
        toast('Launch Failed', err.message);
      });
      return;
    }

    if (window.SaturnApps && typeof window.SaturnApps.open === 'function') {
      window.SaturnApps.open(appId, arg);
    }
  }

  // ====================================================================
  // TASKBAR & STATUS TRAY
  // ====================================================================
  function updateTaskbar() {
    const taskbar = document.getElementById('taskbar');
    if (!taskbar) return;

    const allWins = window.SaturnWM ? window.SaturnWM.getAllWindows() : [];
    const activeWin = window.SaturnWM ? window.SaturnWM.getActiveWindow() : null;

    // Collect all app IDs that are pinned or currently running
    const appIds = [];
    Object.keys(APPS_META).forEach(id => {
      if (APPS_META[id].pinned) appIds.push(id);
    });
    allWins.forEach(w => {
      if (!appIds.includes(w.appId) && APPS_META[w.appId]) {
        appIds.push(w.appId);
      }
    });

    let html = `
      <div class="taskbar-btn" id="btn-start" title="Launcher (Meta / Super)">
        ${window.SaturnIcons.badge('saturn', ['#eab308', '#ca8a04'], 28)}
      </div>
      <div class="taskbar-btn" id="btn-search" title="Search (Ctrl+Space)">
        ${window.SaturnIcons.svg('search')}
      </div>
      <div class="taskbar-separator"></div>
    `;

    appIds.forEach(id => {
      const meta = APPS_META[id];
      const runningWins = allWins.filter(w => w.appId === id);
      const isRunning = runningWins.length > 0;
      const isActive = activeWin && activeWin.appId === id && !activeWin.minimized;

      html += `
        <div class="taskbar-btn ${isRunning ? 'running' : ''} ${isActive ? 'active' : ''}" data-app="${id}" title="${meta.name}">
          ${window.SaturnIcons.badge(meta.icon, meta.colors, 28)}
        </div>
      `;
    });

    html += `
      <div class="taskbar-spacer"></div>
      <div id="status-tray" title="Quick Settings">
        <span class="tray-icon" id="tray-wifi">${window.SaturnIcons.svg('wifi')}</span>
        <span class="tray-icon" id="tray-vol">${window.SaturnIcons.svg('vol')}</span>
        <span class="tray-icon" id="tray-batt" style="display: none;">${window.SaturnIcons.svg('batt')}</span>
        <span class="tray-icon" id="tray-bell">${window.SaturnIcons.svg('bell')}</span>
        <div id="tray-clock"></div>
      </div>
    `;

    taskbar.innerHTML = html;
    updateClock();
    checkBatteryState();

    // Event Bindings
    document.getElementById('btn-start').onclick = () => toggleLauncher();
    document.getElementById('btn-search').onclick = () => openSearch();
    document.getElementById('status-tray').onclick = () => toggleQuickSettings();

    taskbar.querySelectorAll('.taskbar-btn[data-app]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.app;
        const wins = allWins.filter(w => w.appId === id);
        if (wins.length === 0 || APPS_META[id].isNative) {
          launchApp(id);
        } else {
          const topWin = wins[wins.length - 1];
          if (topWin === activeWin && !topWin.minimized) {
            window.SaturnWM.minimizeWindow(topWin);
          } else {
            window.SaturnWM.restoreWindow(topWin);
            window.SaturnWM.focusWindow(topWin);
          }
        }
      };
    });
  }

  function updateClock() {
    const clockEl = document.getElementById('tray-clock');
    if (!clockEl) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    clockEl.innerHTML = `<div>${timeStr}</div><div style="font-size:10px; opacity:0.75;">${dateStr}</div>`;

    // Update Lock Screen Clock if active
    const lockClock = document.getElementById('lock-screen-clock');
    const lockDate = document.getElementById('lock-screen-date');
    if (lockClock && lockDate) {
      lockClock.textContent = timeStr;
      lockDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }
  }

  // Battery check (Bug 3: Real data from /api/sysinfo; if null on VM, hide completely!)
  async function checkBatteryState() {
    try {
      const info = await api('/api/sysinfo');
      const battEl = document.getElementById('tray-batt');
      if (!battEl) return;

      if (info && info.battery && typeof info.battery.capacity === 'number') {
        battEl.style.display = 'inline-flex';
        battEl.title = `Battery: ${info.battery.capacity}% (${info.battery.status})`;
        const isCharging = info.battery.status.toLowerCase().includes('charge');
        battEl.innerHTML = window.SaturnIcons.svg(isCharging ? 'batt-charging' : 'batt');
      } else {
        // VM with no battery: MUST stay completely hidden!
        battEl.style.display = 'none';
      }
    } catch (e) {
      const battEl = document.getElementById('tray-batt');
      if (battEl) battEl.style.display = 'none';
    }
  }

  // ====================================================================
  // QUICK SETTINGS
  // ====================================================================
  function toggleQuickSettings() {
    const qs = document.getElementById('quick-settings');
    if (!qs) return;
    if (qs.classList.contains('active')) {
      qs.classList.remove('active');
    } else {
      renderQuickSettings();
      qs.classList.add('active');
    }
  }

  function renderQuickSettings() {
    const qs = document.getElementById('quick-settings');
    if (!qs) return;

    const accents = ['blue', 'purple', 'green', 'orange', 'red', 'teal'];
    const accentDots = accents.map(c => `
      <div class="accent-dot ${State.accent === c ? 'selected' : ''}" data-accent="${c}" style="background-color: var(--accent-${c});"></div>
    `).join('');

    qs.innerHTML = `
      <div class="qs-toggles">
        <button class="qs-btn ${State.theme === 'light' ? 'active' : ''}" id="qs-theme-btn">
          ${window.SaturnIcons.svg(State.theme === 'light' ? 'sun' : 'moon')}
          <span>${State.theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button class="qs-btn ${!State.effects ? 'active' : ''}" id="qs-effects-btn">
          ${window.SaturnIcons.svg('effects')}
          <span>${State.effects ? 'Effects: Full' : 'Effects: Reduced'}</span>
        </button>
      </div>

      <div class="qs-slider-group">
        <div class="qs-slider-row">
          ${window.SaturnIcons.svg('vol')}
          <input type="range" id="qs-vol-slider" min="0" max="100" value="${State.volume}">
        </div>
        <div class="qs-slider-row">
          ${window.SaturnIcons.svg('sun')}
          <input type="range" id="qs-bright-slider" min="30" max="100" value="${State.brightness}">
        </div>
      </div>

      <div class="qs-accent-row">
        ${accentDots}
      </div>

      <div style="font-size: 11.5px; font-weight: 600; color: var(--text-dim); margin-top: 4px; display: flex; justify-content: space-between;">
        <span>Notifications</span>
        <a href="#" id="qs-clear-notifs" style="color: var(--accent); text-decoration: none; font-size: 11px;">Clear</a>
      </div>
      <div id="qs-notifs-list" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
        ${notifications.length === 0 ? '<div style="color: var(--text-muted); font-size: 11px; padding: 4px 0;">No notifications</div>' : notifications.slice(0, 4).map(n => `
          <div style="background: var(--surface-1); border-radius: 6px; padding: 6px 8px;">
            <div style="font-weight: 500; font-size: 11.5px;">${escapeHtml(n.title)}</div>
            <div style="font-size: 10.5px; color: var(--text-dim);">${escapeHtml(n.message)}</div>
          </div>
        `).join('')}
      </div>

      <div class="qs-power-row">
        <button id="qs-lock-btn">${window.SaturnIcons.svg('lock')} Lock</button>
        <button id="qs-power-btn">${window.SaturnIcons.svg('power')} Power</button>
      </div>
    `;

    // Bindings
    document.getElementById('qs-theme-btn').onclick = () => {
      State.theme = State.theme === 'dark' ? 'light' : 'dark';
      applySettings();
      renderQuickSettings();
    };

    document.getElementById('qs-effects-btn').onclick = () => {
      State.effects = !State.effects;
      applySettings();
      renderQuickSettings();
    };

    document.getElementById('qs-vol-slider').oninput = e => {
      State.volume = parseInt(e.target.value, 10);
      saveSettings();
    };

    document.getElementById('qs-bright-slider').oninput = e => {
      State.brightness = parseInt(e.target.value, 10);
      document.body.style.filter = State.brightness < 100 ? `brightness(${State.brightness / 100})` : 'none';
      saveSettings();
    };

    qs.querySelectorAll('.accent-dot').forEach(dot => {
      dot.onclick = () => {
        State.accent = dot.dataset.accent;
        applySettings();
        renderQuickSettings();
      };
    });

    document.getElementById('qs-clear-notifs').onclick = e => {
      e.preventDefault();
      notifications = [];
      Storage.set('saturn.notifications', []);
      renderQuickSettings();
    };

    document.getElementById('qs-lock-btn').onclick = () => {
      qs.classList.remove('active');
      lockScreen();
    };

    document.getElementById('qs-power-btn').onclick = e => {
      qs.classList.remove('active');
      const r = e.target.getBoundingClientRect();
      openContextMenu(r.left, r.top - 160, getPowerMenuItems());
    };
  }

  // ====================================================================
  // LAUNCHER & GLOBAL SEARCH
  // ====================================================================
  let searchDebounceTimer = null;
  let searchResults = [];
  let searchSelectionIndex = 0;

  function toggleLauncher() {
    const launcher = document.getElementById('launcher');
    if (!launcher) return;
    if (launcher.classList.contains('active')) {
      launcher.classList.remove('active');
    } else {
      openSearch('');
    }
  }

  function openSearch(query = '') {
    const launcher = document.getElementById('launcher');
    const input = document.getElementById('launcher-input');
    if (!launcher || !input) return;

    launcher.classList.add('active');
    input.value = query;
    input.focus();
    renderSearchResults(query);
  }

  function closeLauncher() {
    const launcher = document.getElementById('launcher');
    if (launcher) launcher.classList.remove('active');
  }

  function fuzzyMatch(needle, haystack) {
    needle = needle.toLowerCase();
    haystack = haystack.toLowerCase();
    let nIdx = 0;
    let score = 0;
    for (let hIdx = 0; hIdx < haystack.length && nIdx < needle.length; hIdx++) {
      if (haystack[hIdx] === needle[nIdx]) {
        score += (hIdx === 0 ? 5 : 2);
        nIdx++;
      }
    }
    return nIdx === needle.length ? score : 0;
  }

  async function renderSearchResults(query = '', serverFiles = null) {
    const resultsContainer = document.getElementById('launcher-results');
    if (!resultsContainer) return;
    const q = query.trim();

    if (!q) {
      // Show App Grid
      const apps = Object.keys(APPS_META);
      resultsContainer.innerHTML = `
        <div class="launcher-app-grid">
          ${apps.map(id => {
            const a = APPS_META[id];
            return `
              <div class="launcher-app-card" data-app="${id}">
                ${window.SaturnIcons.badge(a.icon, a.colors, 48)}
                <span class="name">${a.name}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      resultsContainer.querySelectorAll('.launcher-app-card').forEach(card => {
        card.onclick = () => {
          closeLauncher();
          launchApp(card.dataset.app);
        };
      });
      searchResults = [];
      return;
    }

    // Searching: Apps, Settings, Files, Ask AI
    searchResults = [];

    // Apps matching
    Object.keys(APPS_META).forEach(id => {
      const a = APPS_META[id];
      const score = fuzzyMatch(q, a.name);
      if (score > 0) {
        searchResults.push({
          score: score + 10,
          title: a.name,
          sub: 'Application',
          icon: a.icon,
          colors: a.colors,
          action: () => launchApp(id)
        });
      }
    });

    // Settings matching
    const settingsOpts = [
      { name: 'Display & Wallpaper', sub: 'Settings' },
      { name: 'Theme & Accent Color', sub: 'Settings' },
      { name: 'Effects & Animations', sub: 'Settings' },
      { name: 'Security & Lock Password', sub: 'Settings' },
      { name: 'About Saturn OS', sub: 'Settings' }
    ];
    settingsOpts.forEach(s => {
      const score = fuzzyMatch(q, s.name);
      if (score > 0) {
        searchResults.push({
          score,
          title: s.name,
          sub: s.sub,
          icon: 'settings',
          colors: ['#94a3b8', '#64748b'],
          action: () => launchApp('settings')
        });
      }
    });

    // Files matching (from server or instant)
    if (serverFiles && Array.isArray(serverFiles)) {
      serverFiles.forEach(f => {
        searchResults.push({
          score: 2,
          title: f.name,
          sub: f.path.replace(HOME_DIR, '~'),
          icon: f.type === 'dir' ? 'folder' : 'file',
          colors: f.type === 'dir' ? ['#4f8eff', '#2563eb'] : ['#6b7280', '#4b5563'],
          action: () => {
            if (f.type === 'dir') launchApp('files', f.path);
            else openFileByExt(f.path);
          }
        });
      });
    }

    searchResults.sort((a, b) => b.score - a.score);

    // Always append "Ask Saturn AI"
    searchResults.push({
      score: -1,
      title: `Ask Saturn AI: "${q}"`,
      sub: 'AI Assistant',
      icon: 'ai',
      colors: ['#a855f7', '#6366f1'],
      action: () => launchApp('ai', q)
    });

    searchSelectionIndex = 0;
    renderResultRows();
  }

  function renderResultRows() {
    const resultsContainer = document.getElementById('launcher-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = searchResults.slice(0, 10).map((r, idx) => `
      <div class="search-result-item ${idx === searchSelectionIndex ? 'selected' : ''}" data-idx="${idx}">
        ${window.SaturnIcons.badge(r.icon, r.colors, 32)}
        <div class="meta">
          <div class="title">${escapeHtml(r.title)}</div>
          <small>${escapeHtml(r.sub)}</small>
        </div>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.onclick = () => {
        closeLauncher();
        const idx = parseInt(item.dataset.idx, 10);
        if (searchResults[idx]) searchResults[idx].action();
      };
    });
  }

  // Bind Launcher Input Events
  function bindLauncherEvents() {
    const input = document.getElementById('launcher-input');
    const launcher = document.getElementById('launcher');
    if (!input || !launcher) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      renderSearchResults(q);

      clearTimeout(searchDebounceTimer);
      if (q.length >= 2) {
        searchDebounceTimer = setTimeout(async () => {
          try {
            const data = await api(`/api/fs/search?q=${encodeURIComponent(q)}`);
            if (input.value.trim() === q) {
              renderSearchResults(q, data.results);
            }
          } catch (e) {}
        }, 180);
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeLauncher();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (searchResults.length > 0) {
          searchSelectionIndex = (searchSelectionIndex + 1) % Math.min(searchResults.length, 10);
          renderResultRows();
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (searchResults.length > 0) {
          searchSelectionIndex = (searchSelectionIndex - 1 + Math.min(searchResults.length, 10)) % Math.min(searchResults.length, 10);
          renderResultRows();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[searchSelectionIndex]) {
          closeLauncher();
          searchResults[searchSelectionIndex].action();
        }
      }
    });

    launcher.addEventListener('click', e => {
      if (e.target === launcher) closeLauncher();
    });
  }

  // ====================================================================
  // CONTEXT MENUS
  // ====================================================================
  function openContextMenu(x, y, items) {
    const menuEl = document.getElementById('context-menu');
    if (!menuEl) return;

    menuEl.innerHTML = '';
    menuEl.style.display = 'block';

    function buildItems(list, host) {
      list.forEach(item => {
        if (item === '-') {
          const sep = document.createElement('div');
          sep.className = 'menu-separator';
          host.appendChild(sep);
          return;
        }

        const el = document.createElement('div');
        el.className = `menu-item ${item.disabled ? 'disabled' : ''}`;
        el.innerHTML = `
          <span>${escapeHtml(item.label)}</span>
          ${item.submenu ? `<span>${window.SaturnIcons.svg('chevron-right')}</span>` : ''}
        `;

        if (item.submenu) {
          const subEl = document.createElement('div');
          subEl.className = 'sub-menu';
          buildItems(item.submenu, subEl);
          el.appendChild(subEl);
        } else if (item.action) {
          el.onclick = ev => {
            ev.stopPropagation();
            closeContextMenu();
            item.action();
          };
        }

        host.appendChild(el);
      });
    }

    buildItems(items, menuEl);

    // Bounding calculation (keep inside viewport)
    const rect = menuEl.getBoundingClientRect();
    const finalX = Math.max(6, Math.min(window.innerWidth - rect.width - 6, x));
    const finalY = Math.max(6, Math.min(window.innerHeight - rect.height - 6, y));

    menuEl.style.left = finalX + 'px';
    menuEl.style.top = finalY + 'px';
  }

  function closeContextMenu() {
    const menuEl = document.getElementById('context-menu');
    if (menuEl) menuEl.style.display = 'none';
  }

  function getPowerMenuItems() {
    return [
      { label: 'Lock Screen', action: () => lockScreen() },
      { label: 'Log Out', action: () => confirmDialog('Log Out', 'End your current session?', () => api('/api/power', { method: 'POST', body: { action: 'logout' } })) },
      '-',
      { label: 'Restart System', action: () => confirmDialog('Restart', 'Reboot Saturn OS now?', () => api('/api/power', { method: 'POST', body: { action: 'reboot' } })) },
      { label: 'Shut Down', action: () => confirmDialog('Shut Down', 'Power off Saturn OS?', () => api('/api/power', { method: 'POST', body: { action: 'shutdown' } })) }
    ];
  }

  // ====================================================================
  // DESKTOP & RUBBERBAND SELECTION
  // ====================================================================
  async function refreshDesktop() {
    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;

    try {
      const data = await api(`/api/fs/list?path=${encodeURIComponent(DESKTOP_DIR)}`);
      renderDesktopIcons(data.items || []);
    } catch (e) {
      renderDesktopIcons([]);
    }
  }

  function renderDesktopIcons(files) {
    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;

    // Desktop items: Home, Trash, plus Desktop files
    const allItems = [
      { name: 'Home', path: HOME_DIR, type: 'dir', isSystem: true, icon: 'home', colors: ['#4f8eff', '#2563eb'] },
      { name: 'Trash', path: TRASH_DIR, type: 'dir', isSystem: true, icon: 'trash', colors: ['#64748b', '#475569'] }
    ];

    files.forEach(f => {
      const isDir = f.type === 'dir';
      const ext = f.name.split('.').pop().toLowerCase();
      let icon = isDir ? 'folder' : 'file';
      let colors = isDir ? ['#4f8eff', '#2563eb'] : ['#6b7280', '#4b5563'];

      if (/^(png|jpe?g|webp|gif|svg)$/.test(ext)) {
        icon = 'file-image';
        colors = ['#c084fc', '#9333ea'];
      } else if (/^(mp3|wav|ogg|flac|m4a)$/.test(ext)) {
        icon = 'file-audio';
        colors = ['#fbbf24', '#d97706'];
      } else if (/^(mp4|webm)$/.test(ext)) {
        icon = 'file-video';
        colors = ['#f87171', '#dc2626'];
      } else if (/^(js|html|css|json|py|sh|c|h|md)$/.test(ext)) {
        icon = 'file-code';
        colors = ['#38bdf8', '#0284c7'];
      }

      allItems.push({
        name: f.name,
        path: `${DESKTOP_DIR}/${f.name}`,
        type: f.type,
        icon,
        colors
      });
    });

    desktopEl.innerHTML = '';
    const colHeight = Math.floor((window.innerHeight - 80) / 96);

    allItems.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      el.dataset.path = item.path;
      el.dataset.type = item.type;
      el.dataset.name = item.name;

      // Positioning: saved coordinates or default column layout
      const saved = desktopPositions[item.name];
      if (saved && typeof saved.x === 'number') {
        el.style.left = saved.x + 'px';
        el.style.top = saved.y + 'px';
      } else {
        const col = Math.floor(idx / colHeight);
        const row = idx % colHeight;
        el.style.left = (16 + col * 96) + 'px';
        el.style.top = (16 + row * 96) + 'px';
      }

      el.innerHTML = `
        ${window.SaturnIcons.badge(item.icon, item.colors, 44)}
        <span class="label">${escapeHtml(item.name)}</span>
      `;

      desktopEl.appendChild(el);
      setupDesktopIconInteractions(el, item);
    });
  }

  function setupDesktopIconInteractions(el, item) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    el.onpointerdown = e => {
      if (e.button !== 0) return; // Left click only for dragging
      e.stopPropagation();

      if (!e.ctrlKey && !el.classList.contains('selected')) {
        document.querySelectorAll('.desktop-icon.selected').forEach(i => i.classList.remove('selected'));
      }
      el.classList.add('selected');

      startX = e.clientX;
      startY = e.clientY;
      origLeft = el.offsetLeft;
      origTop = el.offsetTop;
      isDragging = false;

      function onPointerMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          isDragging = true;
        }
        if (isDragging) {
          el.style.left = Math.max(8, Math.min(window.innerWidth - 100, origLeft + dx)) + 'px';
          el.style.top = Math.max(8, Math.min(window.innerHeight - 80 - 46, origTop + dy)) + 'px';
        }
      }

      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (isDragging) {
          desktopPositions[item.name] = { x: el.offsetLeft, y: el.offsetTop };
          Storage.set('saturn.desktop_positions', desktopPositions);
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    el.ondblclick = () => {
      if (item.type === 'dir') {
        launchApp('files', item.path);
      } else {
        openFileByExt(item.path);
      }
    };

    // Drag and Drop (HTML5 drag API between Files and Desktop)
    el.draggable = true;
    el.ondragstart = e => {
      e.dataTransfer.setData('application/saturn-path', item.path);
    };
  }

  function openFileByExt(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    if (/^(png|jpe?g|webp|gif|svg|mp3|wav|ogg|flac|m4a|mp4|webm)$/.test(ext)) {
      launchApp('viewer', filePath);
    } else {
      launchApp('editor', filePath);
    }
  }

  // Desktop Rubberband Selection
  function bindDesktopSelection() {
    const desktopEl = document.getElementById('desktop');
    const boxEl = document.getElementById('selection-box');
    if (!desktopEl || !boxEl) return;

    let startX = 0;
    let startY = 0;
    let selecting = false;

    desktopEl.onpointerdown = e => {
      if (e.target !== desktopEl) return;
      if (e.button !== 0) return;

      if (!e.ctrlKey) {
        document.querySelectorAll('.desktop-icon.selected').forEach(i => i.classList.remove('selected'));
      }

      startX = e.clientX;
      startY = e.clientY;
      selecting = true;
      boxEl.style.left = startX + 'px';
      boxEl.style.top = startY + 'px';
      boxEl.style.width = '0px';
      boxEl.style.height = '0px';
      boxEl.style.display = 'block';

      function onPointerMove(ev) {
        if (!selecting) return;
        const curX = ev.clientX;
        const curY = ev.clientY;
        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const w = Math.abs(curX - startX);
        const h = Math.abs(curY - startY);

        boxEl.style.left = x + 'px';
        boxEl.style.top = y + 'px';
        boxEl.style.width = w + 'px';
        boxEl.style.height = h + 'px';

        // Check intersections with desktop icons
        document.querySelectorAll('.desktop-icon').forEach(iconEl => {
          const r = iconEl.getBoundingClientRect();
          const overlap = !(r.right < x || r.left > x + w || r.bottom < y || r.top > y + h);
          iconEl.classList.toggle('selected', overlap);
        });
      }

      function onPointerUp() {
        selecting = false;
        boxEl.style.display = 'none';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    // Drag-over & drop from Files window to Desktop
    desktopEl.ondragover = e => e.preventDefault();
    desktopEl.ondrop = async e => {
      e.preventDefault();
      const srcPath = e.dataTransfer.getData('application/saturn-path');
      if (srcPath) {
        try {
          await api('/api/fs/move', { method: 'POST', body: { src: srcPath, dest: DESKTOP_DIR } });
          toast('Moved', `Moved ${srcPath.split('/').pop()} to Desktop`);
          refreshDesktop();
          const filesWin = window.SaturnWM.getAllWindows().find(w => w.appId === 'files');
          if (filesWin && filesWin.refresh) filesWin.refresh();
        } catch (err) {
          toast('Move Failed', err.message);
        }
      }
    };
  }

  // ====================================================================
  // GLOBAL CONTEXT MENU DISPATCHER
  // ====================================================================
  function bindContextMenu() {
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;

      // 1. Desktop Icon right click
      const iconEl = e.target.closest('.desktop-icon');
      if (iconEl) {
        const itemPath = iconEl.dataset.path;
        const isDir = iconEl.dataset.type === 'dir';
        const name = iconEl.dataset.name;
        openContextMenu(x, y, [
          { label: 'Open', action: () => isDir ? launchApp('files', itemPath) : openFileByExt(itemPath) },
          {
            label: 'Open With',
            submenu: [
              { label: 'Text Editor', action: () => launchApp('editor', itemPath) },
              { label: 'Media Viewer', action: () => launchApp('viewer', itemPath) },
              { label: 'Terminal here', action: () => launchApp('terminal', isDir ? itemPath : DESKTOP_DIR) }
            ]
          },
          '-',
          { label: 'Rename', action: () => promptDialog('Rename Item', name, n => api('/api/fs/rename', { method: 'POST', body: { path: itemPath, name: n } }).then(refreshDesktop).catch(err => toast('Rename Failed', err.message))) },
          { label: 'Copy', action: () => { clipboard = { action: 'copy', path: itemPath }; toast('Copied', name); } },
          { label: 'Cut', action: () => { clipboard = { action: 'cut', path: itemPath }; toast('Cut', name); } },
          { label: 'Move to Trash', action: () => api('/api/fs/delete', { method: 'POST', body: { path: itemPath } }).then(refreshDesktop).catch(err => toast('Delete Failed', err.message)) },
          '-',
          { label: 'Properties', action: () => showFileProperties(itemPath) }
        ]);
        return;
      }

      // 2. Window Titlebar right click
      const titlebar = e.target.closest('.win-titlebar');
      if (titlebar) {
        const win = titlebar.closest('.win')?._win;
        if (win) {
          openContextMenu(x, y, [
            { label: 'Minimize', action: () => window.SaturnWM.minimizeWindow(win) },
            { label: win.maximized ? 'Restore' : 'Maximize', action: () => window.SaturnWM.maximizeWindow(win) },
            '-',
            { label: 'Close', action: () => window.SaturnWM.closeWindow(win) }
          ]);
          return;
        }
      }

      // 3. Taskbar button right click
      const taskbarBtn = e.target.closest('.taskbar-btn[data-app]');
      if (taskbarBtn) {
        const appId = taskbarBtn.dataset.app;
        const meta = APPS_META[appId];
        const wins = window.SaturnWM.getWindowsByAppId(appId);
        openContextMenu(x, y, [
          { label: `Open new ${meta.name}`, action: () => launchApp(appId) },
          { label: `Close all ${meta.name} windows`, disabled: wins.length === 0, action: () => wins.forEach(w => window.SaturnWM.closeWindow(w)) }
        ]);
        return;
      }

      // 4. Desktop background right click
      if (e.target.id === 'desktop' || e.target.id === 'wp' || e.target.id === 'wp-vignette' || e.target.id === 'wp-image') {
        openContextMenu(x, y, [
          { label: 'New Folder', action: () => promptDialog('New Folder Name', 'New Folder', n => api('/api/fs/mkdir', { method: 'POST', body: { path: DESKTOP_DIR, name: n } }).then(refreshDesktop).catch(err => toast('Failed', err.message))) },
          { label: 'New Text File', action: () => promptDialog('New File Name', 'untitled.txt', n => api('/api/fs/write', { method: 'POST', body: { path: `${DESKTOP_DIR}/${n}`, content: '' } }).then(refreshDesktop).catch(err => toast('Failed', err.message))) },
          { label: 'Paste', disabled: !clipboard, action: () => pasteClipboard(DESKTOP_DIR) },
          '-',
          {
            label: 'Change Wallpaper',
            submenu: [
              { label: 'Default Saturn Photo', action: () => { State.customWallpaper = null; applySettings(); } },
              { label: 'Pick Image via Files...', action: () => launchApp('settings') }
            ]
          },
          { label: 'Display Settings', action: () => launchApp('settings') },
          { label: 'Refresh Desktop', action: () => refreshDesktop() },
          '-',
          { label: 'Open Terminal here', action: () => launchApp('terminal', DESKTOP_DIR) }
        ]);
        return;
      }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('#context-menu')) {
        closeContextMenu();
      }
      if (!e.target.closest('#quick-settings') && !e.target.closest('#status-tray')) {
        const qs = document.getElementById('quick-settings');
        if (qs) qs.classList.remove('active');
      }
    });
  }

  async function pasteClipboard(destDir) {
    if (!clipboard || !clipboard.path) return;
    const endpoint = clipboard.action === 'cut' ? '/api/fs/move' : '/api/fs/copy';
    try {
      await api(endpoint, { method: 'POST', body: { src: clipboard.path, dest: destDir } });
      toast('Success', `Pasted into ${destDir.split('/').pop()}`);
      if (clipboard.action === 'cut') clipboard = null;
      refreshDesktop();
    } catch (err) {
      toast('Paste Failed', err.message);
    }
  }

  async function showFileProperties(filePath) {
    try {
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
      const data = await api(`/api/fs/list?path=${encodeURIComponent(parentDir)}`);
      const item = data.items.find(i => i.name === fileName) || { name: fileName, size: 0, type: 'file', mtime: Date.now() };

      modalDialog(`
        <h3>Properties: ${escapeHtml(item.name)}</h3>
        <div style="font-size: 12px; display: flex; flex-direction: column; gap: 6px; margin: 12px 0;">
          <div><b>Type:</b> ${item.type === 'dir' ? 'Folder' : 'Regular File'}</div>
          <div><b>Location:</b> ${escapeHtml(filePath)}</div>
          <div><b>Size:</b> ${formatBytes(item.size)}</div>
          <div><b>Modified:</b> ${new Date(item.mtime).toLocaleString()}</div>
        </div>
        <div class="actions">
          <button class="btn-primary" data-action="cancel">Close</button>
        </div>
      `);
    } catch (err) {
      toast('Properties Error', err.message);
    }
  }

  // ====================================================================
  // LOCK SCREEN & SECURITY
  // ====================================================================
  async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function setLockPassword(newPassword) {
    if (!newPassword) {
      State.passwordHash = null;
      State.passwordSalt = null;
      saveSettings();
      toast('Password Removed', 'Lock screen has no password');
      return;
    }
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await hashPassword(newPassword, salt);
    State.passwordHash = hash;
    State.passwordSalt = salt;
    saveSettings();
    toast('Password Saved', 'Lock screen password set successfully');
  }

  function lockScreen() {
    const lockEl = document.getElementById('lock-screen');
    const input = document.getElementById('lock-screen-input');
    const hint = document.getElementById('lock-screen-hint');
    if (!lockEl || !input) return;

    lockEl.classList.add('active');
    updateClock();

    if (State.passwordHash) {
      input.style.display = 'block';
      input.value = '';
      input.focus();
      hint.textContent = 'Enter password and press Enter to unlock';
    } else {
      input.style.display = 'none';
      hint.textContent = 'Press any key or click anywhere to unlock';
    }
  }

  async function attemptUnlock() {
    const lockEl = document.getElementById('lock-screen');
    const input = document.getElementById('lock-screen-input');
    if (!lockEl) return;

    if (!State.passwordHash) {
      lockEl.classList.remove('active');
      return;
    }

    const entered = input.value;
    const computedHash = await hashPassword(entered, State.passwordSalt);
    if (computedHash === State.passwordHash) {
      lockEl.classList.remove('active');
    } else {
      input.style.borderColor = '#ef4444';
      input.style.boxShadow = '0 0 8px #ef4444';
      input.value = '';
      setTimeout(() => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      }, 1000);
    }
  }

  function bindLockEvents() {
    const lockEl = document.getElementById('lock-screen');
    const input = document.getElementById('lock-screen-input');
    if (!lockEl || !input) return;

    lockEl.addEventListener('click', e => {
      if (e.target !== input) {
        if (!State.passwordHash) attemptUnlock();
      }
    });

    window.addEventListener('keydown', e => {
      if (!lockEl.classList.contains('active')) return;
      if (!State.passwordHash) {
        attemptUnlock();
      } else if (e.key === 'Enter') {
        attemptUnlock();
      }
    });
  }

  // ====================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ====================================================================
  function bindGlobalKeyboard() {
    window.addEventListener('keydown', e => {
      const lockEl = document.getElementById('lock-screen');
      if (lockEl && lockEl.classList.contains('active')) return;

      // Ctrl + Space -> Toggle Search
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        const launcher = document.getElementById('launcher');
        if (launcher && launcher.classList.contains('active')) {
          closeLauncher();
        } else {
          openSearch('');
        }
        return;
      }

      // Meta / Super key alone
      if (e.key === 'Meta') {
        e.preventDefault();
        return;
      }

      // F2 Rename selected desktop icon
      if (e.key === 'F2') {
        const sel = document.querySelector('.desktop-icon.selected');
        if (sel) {
          e.preventDefault();
          const name = sel.dataset.name;
          const p = sel.dataset.path;
          promptDialog('Rename', name, n => api('/api/fs/rename', { method: 'POST', body: { path: p, name: n } }).then(refreshDesktop).catch(err => toast('Rename Failed', err.message)));
        }
      }

      // Delete key move to trash
      if (e.key === 'Delete') {
        const sel = document.querySelector('.desktop-icon.selected');
        if (sel && !e.target.closest('input, textarea')) {
          e.preventDefault();
          const p = sel.dataset.path;
          api('/api/fs/delete', { method: 'POST', body: { path: p } }).then(refreshDesktop).catch(err => toast('Delete Failed', err.message));
        }
      }
    });

    window.addEventListener('keyup', e => {
      if (e.key === 'Meta' && !e.ctrlKey && !e.altKey) {
        const launcher = document.getElementById('launcher');
        if (launcher && launcher.classList.contains('active')) closeLauncher();
        else openSearch('');
      }
    });
  }

  // ====================================================================
  // BOOT ANIMATION
  // ====================================================================
  function runBootSequence() {
    const bootEl = document.getElementById('boot-screen');
    if (!bootEl) return;

    // Boot duration strictly under 3s
    setTimeout(() => {
      bootEl.classList.add('fade-out');
      setTimeout(() => bootEl.remove(), 600);
    }, 2000);
  }

  // Utilities
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Initialization
  function init() {
    applySettings();
    updateTaskbar();
    refreshDesktop();
    bindLauncherEvents();
    bindContextMenu();
    bindDesktopSelection();
    bindLockEvents();
    bindGlobalKeyboard();
    runBootSequence();

    // Regular interval for clock and battery
    setInterval(updateClock, 1000);
    setInterval(checkBatteryState, 5000);

    // Pause wallpaper motion when page is hidden
    document.addEventListener('visibilitychange', () => {
      const wpImg = document.getElementById('wp-image');
      if (wpImg) {
        wpImg.style.animationPlayState = document.hidden ? 'paused' : 'running';
      }
    });
  }

  return {
    init,
    getState: () => State,
    saveSettings,
    applySettings,
    setLockPassword,
    api,
    toast,
    confirmDialog,
    promptDialog,
    openContextMenu,
    closeContextMenu,
    updateTaskbar,
    refreshDesktop,
    launchApp,
    openSearch,
    lockScreen,
    escapeHtml,
    formatBytes,
    HOME_DIR,
    DESKTOP_DIR,
    TRASH_DIR
  };
})();
