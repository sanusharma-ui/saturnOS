'use strict';

/**
 * Saturn OS - Built-in Applications
 * Files, Text Editor, Media Player, System Monitor, Settings, Calculator, Clock, Calendar.
 */
window.SaturnApps = (function () {
  const { api, toast, confirmDialog, promptDialog, escapeHtml, formatBytes, HOME_DIR, DESKTOP_DIR, TRASH_DIR } = window.SaturnShell;

  // Registry of App Launchers
  const REGISTRY = {
    files: openFilesApp,
    editor: openEditorApp,
    viewer: openViewerApp,
    monitor: openMonitorApp,
    settings: openSettingsApp,
    calc: openCalcApp,
    clock: openClockApp,
    calendar: openCalendarApp,
    ai: (arg) => window.SaturnAI && window.SaturnAI.open(arg)
  };

  function open(appId, arg = null) {
    const fn = REGISTRY[appId];
    if (typeof fn === 'function') {
      fn(arg);
    }
  }

  // ====================================================================
  // 1. FILES APP
  // ====================================================================
  function openFilesApp(initialPath = HOME_DIR) {
    const win = window.SaturnWM.createWindow({
      appId: 'files',
      title: 'Files',
      icon: 'files',
      width: 780,
      height: 520,
      singleInstance: false,
      contentRenderer: (w, arg) => setupFilesWindow(w, arg || initialPath)
    });
    return win;
  }

  function setupFilesWindow(win, startPath) {
    let currentPath = startPath || HOME_DIR;
    let history = [currentPath];
    let historyIndex = 0;
    let items = [];
    let isGridMode = true;
    let filterQuery = '';

    win.bodyEl.innerHTML = `
      <div class="files-app">
        <div class="files-toolbar">
          <div class="files-nav-btns">
            <button class="btn-back" title="Back">${window.SaturnIcons.svg('back')}</button>
            <button class="btn-forward" title="Forward">${window.SaturnIcons.svg('forward')}</button>
            <button class="btn-up" title="Up">${window.SaturnIcons.svg('up')}</button>
          </div>
          <div class="files-breadcrumbs"></div>
          <input type="text" class="files-filter-input" placeholder="Filter..." style="width: 120px; height: 26px; padding: 2px 8px; font-size: 11.5px;">
          <button class="btn-view-toggle" title="Toggle Grid/List">${window.SaturnIcons.svg('view-grid')}</button>
          <button class="btn-new-folder" title="New Folder">${window.SaturnIcons.svg('folder')}</button>
          <button class="btn-new-file" title="New File">${window.SaturnIcons.svg('plus')}</button>
          <button class="btn-empty-trash" title="Empty Trash" style="display: none; color: #ef4444;">${window.SaturnIcons.svg('trash')}</button>
        </div>
        <div class="files-body">
          <div class="files-sidebar">
            <div class="files-sidebar-item" data-path="${HOME_DIR}">
              ${window.SaturnIcons.svg('home')} Home
            </div>
            <div class="files-sidebar-item" data-path="${DESKTOP_DIR}">
              ${window.SaturnIcons.svg('grid')} Desktop
            </div>
            <div class="files-sidebar-item" data-path="${HOME_DIR}/Documents">
              ${window.SaturnIcons.svg('file')} Documents
            </div>
            <div class="files-sidebar-item" data-path="${HOME_DIR}/Downloads">
              ${window.SaturnIcons.svg('forward')} Downloads
            </div>
            <div class="files-sidebar-item" data-path="${HOME_DIR}/Pictures">
              ${window.SaturnIcons.svg('file-image')} Pictures
            </div>
            <div class="files-sidebar-item" data-path="${HOME_DIR}/Music">
              ${window.SaturnIcons.svg('file-audio')} Music
            </div>
            <div class="files-sidebar-item" data-path="${HOME_DIR}/Videos">
              ${window.SaturnIcons.svg('file-video')} Videos
            </div>
            <div class="files-sidebar-item" data-path="${TRASH_DIR}" style="margin-top: auto;">
              ${window.SaturnIcons.svg('trash')} Trash
            </div>
          </div>
          <div class="files-content-view grid-mode"></div>
        </div>
      </div>
    `;

    const crumbsEl = win.bodyEl.querySelector('.files-breadcrumbs');
    const viewEl = win.bodyEl.querySelector('.files-content-view');
    const filterInput = win.bodyEl.querySelector('.files-filter-input');
    const btnBack = win.bodyEl.querySelector('.btn-back');
    const btnForward = win.bodyEl.querySelector('.btn-forward');
    const btnUp = win.bodyEl.querySelector('.btn-up');
    const btnViewToggle = win.bodyEl.querySelector('.btn-view-toggle');
    const btnNewFolder = win.bodyEl.querySelector('.btn-new-folder');
    const btnNewFile = win.bodyEl.querySelector('.btn-new-file');
    const btnEmptyTrash = win.bodyEl.querySelector('.btn-empty-trash');

    async function loadDirectory(targetPath, recordHistory = true) {
      try {
        const data = await api(`/api/fs/list?path=${encodeURIComponent(targetPath)}`);
        currentPath = data.path;
        items = data.items || [];

        if (recordHistory) {
          history = history.slice(0, historyIndex + 1);
          history.push(currentPath);
          historyIndex = history.length - 1;
        }

        win.title = currentPath.replace(HOME_DIR, '~') || 'Files';
        win.el.querySelector('.win-title').textContent = win.title;

        updateNavButtons();
        renderBreadcrumbs();
        renderView();
        updateSidebarActive();
      } catch (err) {
        toast('Files Error', err.message);
      }
    }

    win.refresh = () => loadDirectory(currentPath, false);

    function updateNavButtons() {
      btnBack.disabled = historyIndex <= 0;
      btnForward.disabled = historyIndex >= history.length - 1;
      btnUp.disabled = currentPath === HOME_DIR || currentPath === '/';
      btnEmptyTrash.style.display = currentPath === TRASH_DIR ? 'inline-flex' : 'none';
    }

    function renderBreadcrumbs() {
      crumbsEl.innerHTML = '';
      const parts = currentPath.split('/').filter(Boolean);
      let cumulative = '';

      const rootChip = document.createElement('span');
      rootChip.className = 'files-crumb-chip';
      rootChip.textContent = '/';
      rootChip.onclick = () => loadDirectory(HOME_DIR);
      crumbsEl.appendChild(rootChip);

      parts.forEach((part, idx) => {
        cumulative += '/' + part;
        const target = cumulative;

        const sep = document.createElement('span');
        sep.className = 'files-crumb-sep';
        sep.textContent = '›';
        crumbsEl.appendChild(sep);

        const chip = document.createElement('span');
        chip.className = 'files-crumb-chip';
        chip.textContent = part === 'home' && parts[idx + 1] === 'sanu' ? '~' : part;
        chip.onclick = () => loadDirectory(target);
        crumbsEl.appendChild(chip);
      });
    }

    function updateSidebarActive() {
      win.bodyEl.querySelectorAll('.files-sidebar-item').forEach(el => {
        el.classList.toggle('active', el.dataset.path === currentPath);
      });
    }

    function renderView() {
      viewEl.className = `files-content-view ${isGridMode ? 'grid-mode' : 'list-mode'}`;
      const filtered = items.filter(i => !filterQuery || i.name.toLowerCase().includes(filterQuery));

      if (filtered.length === 0) {
        viewEl.innerHTML = '<div style="color: var(--text-muted); padding: 40px; text-align: center; width: 100%;">Folder is empty</div>';
        return;
      }

      if (isGridMode) {
        viewEl.innerHTML = filtered.map(item => {
          const isDir = item.type === 'dir';
          const ext = item.name.split('.').pop().toLowerCase();
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

          const fullPath = `${currentPath}/${item.name}`;
          return `
            <div class="file-entry" data-name="${escapeHtml(item.name)}" data-path="${escapeHtml(fullPath)}" data-type="${item.type}" draggable="true">
              ${window.SaturnIcons.badge(icon, colors, 44)}
              <span class="name">${escapeHtml(item.name)}</span>
            </div>
          `;
        }).join('');
      } else {
        // List Mode
        viewEl.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(item => {
                const fullPath = `${currentPath}/${item.name}`;
                return `
                  <tr class="file-entry" data-name="${escapeHtml(item.name)}" data-path="${escapeHtml(fullPath)}" data-type="${item.type}" draggable="true">
                    <td>${escapeHtml(item.name)}</td>
                    <td>${item.type === 'dir' ? '—' : formatBytes(item.size)}</td>
                    <td>${item.type === 'dir' ? 'Folder' : 'File'}</td>
                    <td>${new Date(item.mtime).toLocaleDateString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }

      // Bind Entry Interactions
      viewEl.querySelectorAll('.file-entry').forEach(entry => {
        const itemPath = entry.dataset.path;
        const itemType = entry.dataset.type;
        const itemName = entry.dataset.name;

        entry.onclick = e => {
          if (!e.ctrlKey) {
            viewEl.querySelectorAll('.file-entry.selected').forEach(el => el.classList.remove('selected'));
          }
          entry.classList.toggle('selected');
        };

        entry.ondblclick = () => {
          if (itemType === 'dir') {
            loadDirectory(itemPath);
          } else {
            const ext = itemName.split('.').pop().toLowerCase();
            if (/^(png|jpe?g|webp|gif|svg|mp3|wav|ogg|flac|m4a|mp4|webm)$/.test(ext)) {
              open('viewer', itemPath);
            } else {
              open('editor', itemPath);
            }
          }
        };

        // Context Menu on File Entry
        entry.oncontextmenu = e => {
          e.preventDefault();
          e.stopPropagation();
          viewEl.querySelectorAll('.file-entry.selected').forEach(el => el.classList.remove('selected'));
          entry.classList.add('selected');

          window.SaturnShell.openContextMenu(e.clientX, e.clientY, [
            { label: 'Open', action: () => itemType === 'dir' ? loadDirectory(itemPath) : open('editor', itemPath) },
            {
              label: 'Open With',
              submenu: [
                { label: 'Text Editor', action: () => open('editor', itemPath) },
                { label: 'Media Viewer', action: () => open('viewer', itemPath) },
                { label: 'Terminal here', action: () => open('terminal', itemType === 'dir' ? itemPath : currentPath) }
              ]
            },
            '-',
            { label: 'Rename', action: () => promptDialog('Rename Item', itemName, n => api('/api/fs/rename', { method: 'POST', body: { path: itemPath, name: n } }).then(win.refresh).catch(err => toast('Error', err.message))) },
            { label: 'Copy', action: () => toast('Copied', itemName) },
            { label: 'Delete', action: () => api('/api/fs/delete', { method: 'POST', body: { path: itemPath } }).then(win.refresh).catch(err => toast('Error', err.message)) }
          ]);
        };

        // HTML5 Drag
        entry.ondragstart = e => {
          e.dataTransfer.setData('application/saturn-path', itemPath);
        };
      });
    }

    // Nav Bindings
    btnBack.onclick = () => {
      if (historyIndex > 0) {
        historyIndex--;
        loadDirectory(history[historyIndex], false);
      }
    };

    btnForward.onclick = () => {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        loadDirectory(history[historyIndex], false);
      }
    };

    btnUp.onclick = () => {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || HOME_DIR;
      loadDirectory(parent);
    };

    btnViewToggle.onclick = () => {
      isGridMode = !isGridMode;
      btnViewToggle.innerHTML = window.SaturnIcons.svg(isGridMode ? 'view-grid' : 'view-list');
      renderView();
    };

    filterInput.oninput = e => {
      filterQuery = e.target.value.toLowerCase().trim();
      renderView();
    };

    btnNewFolder.onclick = () => {
      promptDialog('New Folder', 'New Folder', n => {
        api('/api/fs/mkdir', { method: 'POST', body: { path: currentPath, name: n } })
          .then(win.refresh)
          .catch(err => toast('Error', err.message));
      });
    };

    btnNewFile.onclick = () => {
      promptDialog('New Text File', 'untitled.txt', n => {
        api('/api/fs/write', { method: 'POST', body: { path: `${currentPath}/${n}`, content: '' } })
          .then(win.refresh)
          .catch(err => toast('Error', err.message));
      });
    };

    btnEmptyTrash.onclick = () => {
      confirmDialog('Empty Trash', 'Permanently delete all files in Trash?', () => {
        api('/api/fs/delete', { method: 'POST', body: { emptyTrash: true } })
          .then(() => {
            toast('Trash Emptied', 'All items deleted');
            win.refresh();
          })
          .catch(err => toast('Error', err.message));
      });
    };

    // Sidebar navigation
    win.bodyEl.querySelectorAll('.files-sidebar-item').forEach(item => {
      item.onclick = () => loadDirectory(item.dataset.path);
    });

    // Content-view background context menu
    viewEl.oncontextmenu = e => {
      if (e.target.closest('.file-entry')) return;
      e.preventDefault();
      window.SaturnShell.openContextMenu(e.clientX, e.clientY, [
        { label: 'New Folder', action: () => btnNewFolder.click() },
        { label: 'New File', action: () => btnNewFile.click() },
        '-',
        { label: 'Refresh', action: win.refresh },
        { label: 'Open Terminal here', action: () => open('terminal', currentPath) }
      ]);
    };

    // Initial load
    loadDirectory(currentPath, true);
  }

  // ====================================================================
  // 2. TEXT EDITOR / NOTES
  // ====================================================================
  function openEditorApp(filePath = null) {
    const win = window.SaturnWM.createWindow({
      appId: 'editor',
      title: 'Text Editor',
      icon: 'editor',
      width: 720,
      height: 500,
      singleInstance: true,
      contentRenderer: (w, arg) => setupEditorWindow(w, arg || filePath)
    });
    return win;
  }

  function setupEditorWindow(win, initialFile) {
    let tabs = []; // { path, name, content, dirty }
    let activeTabIdx = -1;

    win.bodyEl.innerHTML = `
      <div class="editor-app">
        <div class="editor-tabs-bar"></div>
        <div class="editor-main-area">
          <div class="editor-line-numbers">1</div>
          <textarea class="editor-textarea" spellcheck="false" placeholder="Start typing..."></textarea>
        </div>
        <div class="editor-status-bar">
          <button class="btn-primary btn-save" style="padding: 2px 8px; font-size: 11px;">Save (Ctrl+S)</button>
          <span class="editor-status-pos">Line 1, Col 1</span>
          <span class="editor-status-file" style="margin-left: auto;">No file open</span>
        </div>
      </div>
    `;

    const tabsBar = win.bodyEl.querySelector('.editor-tabs-bar');
    const lineNumbers = win.bodyEl.querySelector('.editor-line-numbers');
    const textarea = win.bodyEl.querySelector('.editor-textarea');
    const btnSave = win.bodyEl.querySelector('.btn-save');
    const statusPos = win.bodyEl.querySelector('.editor-status-pos');
    const statusFile = win.bodyEl.querySelector('.editor-status-file');

    function updateLineNumbers() {
      const lines = (textarea.value || '').split('\n').length;
      lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }

    function renderTabs() {
      tabsBar.innerHTML = tabs.map((t, idx) => `
        <div class="editor-tab ${idx === activeTabIdx ? 'active' : ''}" data-idx="${idx}">
          <span>${escapeHtml(t.name)}${t.dirty ? ' •' : ''}</span>
          <span class="close-btn" data-close="${idx}">×</span>
        </div>
      `).join('') + `
        <button class="btn-new-tab" style="padding: 2px 6px; font-size: 11px; margin-left: 4px;" title="New Note">+</button>
      `;

      tabsBar.querySelectorAll('.editor-tab').forEach(tabEl => {
        tabEl.onclick = e => {
          if (e.target.classList.contains('close-btn')) {
            const cIdx = parseInt(e.target.dataset.close, 10);
            closeTab(cIdx);
            return;
          }
          const idx = parseInt(tabEl.dataset.idx, 10);
          switchTab(idx);
        };
      });

      const btnNew = tabsBar.querySelector('.btn-new-tab');
      if (btnNew) {
        btnNew.onclick = () => {
          tabs.push({ path: null, name: `Untitled ${tabs.length + 1}.txt`, content: '', dirty: false });
          switchTab(tabs.length - 1);
        };
      }
    }

    function switchTab(idx) {
      if (idx < 0 || idx >= tabs.length) {
        activeTabIdx = -1;
        textarea.value = '';
        textarea.disabled = true;
        statusFile.textContent = 'No file open';
        renderTabs();
        updateLineNumbers();
        return;
      }
      activeTabIdx = idx;
      const tab = tabs[idx];
      textarea.value = tab.content;
      textarea.disabled = false;
      statusFile.textContent = tab.path || tab.name;
      renderTabs();
      updateLineNumbers();
      textarea.focus();
    }

    async function openFile(p) {
      const existing = tabs.findIndex(t => t.path === p);
      if (existing >= 0) {
        switchTab(existing);
        return;
      }
      try {
        const data = await api(`/api/fs/read?path=${encodeURIComponent(p)}`);
        const name = p.split('/').pop();
        tabs.push({ path: p, name, content: data.content || '', dirty: false });
        switchTab(tabs.length - 1);
      } catch (err) {
        toast('Cannot Open File', err.message);
      }
    }

    async function saveCurrentFile() {
      if (activeTabIdx < 0) return;
      const tab = tabs[activeTabIdx];
      tab.content = textarea.value;

      if (!tab.path) {
        promptDialog('Save As', tab.name, async targetName => {
          tab.path = `${DESKTOP_DIR}/${targetName}`;
          tab.name = targetName;
          await doSave(tab);
        });
      } else {
        await doSave(tab);
      }
    }

    async function doSave(tab) {
      try {
        await api('/api/fs/write', { method: 'POST', body: { path: tab.path, content: tab.content } });
        tab.dirty = false;
        renderTabs();
        toast('File Saved', tab.name);
      } catch (err) {
        toast('Save Failed', err.message);
      }
    }

    function closeTab(idx) {
      const tab = tabs[idx];
      if (tab.dirty) {
        confirmDialog('Unsaved Changes', `Discard changes to ${tab.name}?`, () => {
          tabs.splice(idx, 1);
          switchTab(Math.min(activeTabIdx, tabs.length - 1));
        });
      } else {
        tabs.splice(idx, 1);
        switchTab(Math.min(activeTabIdx, tabs.length - 1));
      }
    }

    textarea.oninput = () => {
      if (activeTabIdx >= 0) {
        tabs[activeTabIdx].content = textarea.value;
        if (!tabs[activeTabIdx].dirty) {
          tabs[activeTabIdx].dirty = true;
          renderTabs();
        }
      }
      updateLineNumbers();
    };

    textarea.onscroll = () => {
      lineNumbers.scrollTop = textarea.scrollTop;
    };

    textarea.onkeydown = e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        textarea.setRangeText('  ', start, textarea.selectionEnd, 'end');
        textarea.dispatchEvent(new Event('input'));
      }
    };

    btnSave.onclick = saveCurrentFile;

    win.onArg = arg => {
      if (typeof arg === 'string') openFile(arg);
    };

    if (initialFile) {
      openFile(initialFile);
    } else {
      tabs.push({ path: null, name: 'Untitled.txt', content: '', dirty: false });
      switchTab(0);
    }
  }

  // ====================================================================
  // 3. MEDIA VIEWER & PLAYER
  // ====================================================================
  function openViewerApp(filePath = null) {
    const win = window.SaturnWM.createWindow({
      appId: 'viewer',
      title: filePath ? filePath.split('/').pop() : 'Media Viewer',
      icon: 'viewer',
      width: 660,
      height: 480,
      singleInstance: false,
      contentRenderer: (w, arg) => setupViewerWindow(w, arg || filePath)
    });
    return win;
  }

  function setupViewerWindow(win, filePath) {
    if (!filePath) {
      win.bodyEl.innerHTML = `
        <div class="media-app">
          <div style="color: var(--text-muted); text-align: center;">
            ${window.SaturnIcons.svg('viewer', 1.5)}
            <div style="margin-top: 10px;">Open an image, audio, or video file from Files</div>
          </div>
        </div>
      `;
      return;
    }

    const ext = filePath.split('.').pop().toLowerCase();
    const fileUrl = `/api/file?path=${encodeURIComponent(filePath)}`;
    const isImage = /^(png|jpe?g|webp|gif|svg|bmp)$/.test(ext);
    const isAudio = /^(mp3|wav|ogg|flac|m4a)$/.test(ext);
    const isVideo = /^(mp4|webm)$/.test(ext);

    win.bodyEl.innerHTML = `<div class="media-app"></div>`;
    const container = win.bodyEl.querySelector('.media-app');

    if (isImage) {
      container.innerHTML = `<img src="${fileUrl}" alt="Photo">`;
    } else if (isVideo) {
      container.innerHTML = `<video src="${fileUrl}" controls autoplay></video>`;
    } else if (isAudio) {
      container.innerHTML = `
        <div class="media-audio-player">
          <div class="icon-badge" style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(145deg, #fbbf24, #d97706);">${window.SaturnIcons.svg('file-audio')}</div>
          <div style="font-weight: 600; font-size: 14px;">${escapeHtml(filePath.split('/').pop())}</div>
          <audio src="${fileUrl}" controls autoplay style="width: 100%;"></audio>
        </div>
      `;
    }

    // Window cleanup on close: stop audio/video
    win.onClose = () => {
      const media = container.querySelector('video, audio');
      if (media) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
    };
  }

  // ====================================================================
  // 4. SYSTEM MONITOR
  // ====================================================================
  function openMonitorApp() {
    const win = window.SaturnWM.createWindow({
      appId: 'monitor',
      title: 'System Monitor',
      icon: 'monitor',
      width: 640,
      height: 480,
      singleInstance: true,
      contentRenderer: setupMonitorWindow
    });
    return win;
  }

  function setupMonitorWindow(win) {
    win.bodyEl.innerHTML = `
      <div class="monitor-app">
        <div class="monitor-card">
          <div class="monitor-card-header">
            <span>CPU History (<span class="mon-cpu-cores">1</span> cores)</span>
            <span class="mon-cpu-val" style="color: var(--accent);">0.0%</span>
          </div>
          <canvas class="monitor-chart-canvas" width="580" height="90"></canvas>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="monitor-card">
            <div class="monitor-card-header">
              <span>Memory</span>
              <span class="mon-mem-pct">0%</span>
            </div>
            <div class="mon-mem-text" style="font-size: 11.5px; color: var(--text-dim);">0 / 0</div>
            <div class="monitor-progress-bar">
              <div class="monitor-progress-fill mon-mem-fill" style="width: 0%;"></div>
            </div>
          </div>
          <div class="monitor-card">
            <div class="monitor-card-header">
              <span>Disk</span>
              <span class="mon-disk-pct">0%</span>
            </div>
            <div class="mon-disk-text" style="font-size: 11.5px; color: var(--text-dim);">0 / 0</div>
            <div class="monitor-progress-bar">
              <div class="monitor-progress-fill mon-disk-fill" style="width: 0%;"></div>
            </div>
          </div>
        </div>

        <div class="monitor-card">
          <div class="monitor-card-header">
            <span>Top Processes</span>
          </div>
          <table class="monitor-proc-table">
            <thead>
              <tr><th>PID</th><th>Process</th><th>CPU %</th><th>Memory</th></tr>
            </thead>
            <tbody class="mon-proc-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const canvas = win.bodyEl.querySelector('.monitor-chart-canvas');
    const ctx = canvas.getContext('2d');
    const cpuVal = win.bodyEl.querySelector('.mon-cpu-val');
    const cpuCores = win.bodyEl.querySelector('.mon-cpu-cores');
    const memPct = win.bodyEl.querySelector('.mon-mem-pct');
    const memText = win.bodyEl.querySelector('.mon-mem-text');
    const memFill = win.bodyEl.querySelector('.mon-mem-fill');
    const diskPct = win.bodyEl.querySelector('.mon-disk-pct');
    const diskText = win.bodyEl.querySelector('.mon-disk-text');
    const diskFill = win.bodyEl.querySelector('.mon-disk-fill');
    const procTbody = win.bodyEl.querySelector('.mon-proc-tbody');

    const historyPoints = [];
    const maxPoints = 40;

    async function poll() {
      // Pause poll when page hidden or window minimized (Performance Rule)
      if (document.hidden || win.minimized) return;

      try {
        const data = await api('/api/sysinfo');
        cpuCores.textContent = data.cores || 1;
        cpuVal.textContent = (data.cpu || 0) + '%';

        // Chart line
        historyPoints.push(data.cpu || 0);
        if (historyPoints.length > maxPoints) historyPoints.shift();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        historyPoints.forEach((val, i) => {
          const x = (i / (maxPoints - 1)) * canvas.width;
          const y = canvas.height - (val / 100) * (canvas.height - 8) - 4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Memory
        const memUsed = data.mem.total - data.mem.avail;
        const memRatio = data.mem.total > 0 ? Math.round((memUsed / data.mem.total) * 100) : 0;
        memPct.textContent = memRatio + '%';
        memText.textContent = `${formatBytes(memUsed)} of ${formatBytes(data.mem.total)}`;
        memFill.style.width = memRatio + '%';

        // Disk
        const diskUsed = data.disk.total - data.disk.free;
        const diskRatio = data.disk.total > 0 ? Math.round((diskUsed / data.disk.total) * 100) : 0;
        diskPct.textContent = diskRatio + '%';
        diskText.textContent = `${formatBytes(diskUsed)} of ${formatBytes(data.disk.total)}`;
        diskFill.style.width = diskRatio + '%';

        // Processes
        procTbody.innerHTML = (data.procs || []).map(p => `
          <tr>
            <td>${p.pid}</td>
            <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
            <td>${p.cpu}%</td>
            <td>${formatBytes(p.mem)}</td>
          </tr>
        `).join('');
      } catch (e) {}
    }

    poll();
    const interval = setInterval(poll, 2000);
    win.onClose = () => clearInterval(interval);
  }

  // ====================================================================
  // 5. SETTINGS APP
  // ====================================================================
  function openSettingsApp() {
    const win = window.SaturnWM.createWindow({
      appId: 'settings',
      title: 'Settings',
      icon: 'settings',
      width: 640,
      height: 480,
      singleInstance: true,
      contentRenderer: setupSettingsWindow
    });
    return win;
  }

  function setupSettingsWindow(win) {
    const state = window.SaturnShell.getState();

    win.bodyEl.innerHTML = `
      <div class="settings-app">
        <div class="settings-sidebar">
          <button class="settings-tab-btn active" data-tab="personalization">
            ${window.SaturnIcons.svg('effects')} Personalization
          </button>
          <button class="settings-tab-btn" data-tab="display">
            ${window.SaturnIcons.svg('viewer')} Display
          </button>
          <button class="settings-tab-btn" data-tab="security">
            ${window.SaturnIcons.svg('lock')} Security
          </button>
          <button class="settings-tab-btn" data-tab="about">
            ${window.SaturnIcons.svg('file')} About
          </button>
        </div>
        <div class="settings-content-area"></div>
      </div>
    `;

    const contentArea = win.bodyEl.querySelector('.settings-content-area');

    function renderTab(tabName) {
      win.bodyEl.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      if (tabName === 'personalization') {
        contentArea.innerHTML = `
          <div class="settings-section">
            <h3 style="font-size: 15px;">Appearance & Themes</h3>
            <div class="settings-row">
              <div>
                <label>Theme</label>
                <small>Switch between dark and light desktop styles</small>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="${state.theme === 'dark' ? 'btn-primary' : ''}" id="set-theme-dark">Dark</button>
                <button class="${state.theme === 'light' ? 'btn-primary' : ''}" id="set-theme-light">Light</button>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <label>Accent Color</label>
                <small>Highlights and window focus accent</small>
              </div>
              <div style="display: flex; gap: 8px;">
                ${['blue', 'purple', 'green', 'orange', 'red', 'teal'].map(c => `
                  <div class="accent-dot ${state.accent === c ? 'selected' : ''}" data-accent="${c}" style="background-color: var(--accent-${c});"></div>
                `).join('')}
              </div>
            </div>

            <div class="settings-row">
              <div>
                <label>Visual Effects</label>
                <small>Reduce blurs and shadows for smoother rendering</small>
              </div>
              <button class="${!state.effects ? 'btn-primary' : ''}" id="set-effects-btn">
                ${state.effects ? 'Reduce Effects' : 'Effects Reduced'}
              </button>
            </div>

            <div class="settings-row">
              <div>
                <label>Wallpaper</label>
                <small>Current photo: ${state.customWallpaper ? escapeHtml(state.customWallpaper.split('/').pop()) : 'Default Saturn Photo'}</small>
              </div>
              <div style="display: flex; gap: 6px;">
                <button id="set-wp-default">Default Saturn</button>
                <button id="set-wp-custom">Choose File...</button>
              </div>
            </div>
          </div>
        `;

        // Bindings
        document.getElementById('set-theme-dark').onclick = () => { state.theme = 'dark'; window.SaturnShell.applySettings(); renderTab('personalization'); };
        document.getElementById('set-theme-light').onclick = () => { state.theme = 'light'; window.SaturnShell.applySettings(); renderTab('personalization'); };
        document.getElementById('set-effects-btn').onclick = () => { state.effects = !state.effects; window.SaturnShell.applySettings(); renderTab('personalization'); };
        document.getElementById('set-wp-default').onclick = () => { state.customWallpaper = null; window.SaturnShell.applySettings(); renderTab('personalization'); toast('Wallpaper', 'Restored default Saturn photo'); };
        document.getElementById('set-wp-custom').onclick = () => {
          promptDialog('Custom Wallpaper Path', `${HOME_DIR}/Pictures/wallpaper.jpg`, p => {
            state.customWallpaper = p;
            window.SaturnShell.applySettings();
            renderTab('personalization');
          });
        };
        contentArea.querySelectorAll('.accent-dot').forEach(dot => {
          dot.onclick = () => {
            state.accent = dot.dataset.accent;
            window.SaturnShell.applySettings();
            renderTab('personalization');
          };
        });
      } else if (tabName === 'display') {
        contentArea.innerHTML = `
          <div class="settings-section">
            <h3 style="font-size: 15px;">Display & Scaling</h3>
            <div class="settings-row">
              <div>
                <label>Interface Scaling</label>
                <small>Adjust UI elements zoom ratio</small>
              </div>
              <div style="display: flex; gap: 6px;">
                ${[0.9, 1.0, 1.1, 1.25].map(scale => `
                  <button class="${state.scale === scale ? 'btn-primary' : ''}" data-scale="${scale}">${Math.round(scale * 100)}%</button>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        contentArea.querySelectorAll('[data-scale]').forEach(btn => {
          btn.onclick = () => {
            state.scale = parseFloat(btn.dataset.scale);
            window.SaturnShell.applySettings();
            renderTab('display');
          };
        });
      } else if (tabName === 'security') {
        contentArea.innerHTML = `
          <div class="settings-section">
            <h3 style="font-size: 15px;">Lock Screen Security</h3>
            <div class="settings-row">
              <div>
                <label>Lock Password</label>
                <small>${state.passwordHash ? 'Password protection is enabled' : 'No password set (click to unlock)'}</small>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn-primary" id="btn-change-pw">${state.passwordHash ? 'Change Password' : 'Set Password'}</button>
                ${state.passwordHash ? '<button id="btn-remove-pw" style="color: #ef4444;">Remove</button>' : ''}
              </div>
            </div>
          </div>
        `;
        document.getElementById('btn-change-pw').onclick = () => {
          promptDialog('Enter New Lock Password', '', pw => {
            window.SaturnShell.setLockPassword(pw.trim());
            renderTab('security');
          });
        };
        const rmBtn = document.getElementById('btn-remove-pw');
        if (rmBtn) {
          rmBtn.onclick = () => {
            confirmDialog('Remove Password', 'Disable lock screen password?', () => {
              window.SaturnShell.setLockPassword('');
              renderTab('security');
            });
          };
        }
      } else if (tabName === 'about') {
        contentArea.innerHTML = `
          <div class="settings-section">
            <h3 style="font-size: 15px;">About Saturn OS</h3>
            <div style="background: var(--surface-1); border-radius: 8px; padding: 14px; font-size: 12.5px; display: flex; flex-direction: column; gap: 8px;">
              <div><b>Operating System:</b> Saturn OS v2.0</div>
              <div><b>Base System:</b> Alpine Linux 3.24 (musl libc)</div>
              <div><b>Runtime:</b> Node.js v24 (Local Kiosk Shell)</div>
              <div class="about-sysinfo">Loading kernel & hardware specs...</div>
            </div>
          </div>
        `;
        api('/api/sysinfo').then(info => {
          const infoEl = contentArea.querySelector('.about-sysinfo');
          if (infoEl) {
            infoEl.innerHTML = `
              <div><b>Hostname:</b> ${escapeHtml(info.hostname)}</div>
              <div><b>Kernel:</b> ${escapeHtml(info.kernel)}</div>
              <div><b>CPU Cores:</b> ${info.cores}</div>
              <div><b>System Uptime:</b> ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m</div>
            `;
          }
        }).catch(() => {});
      }
    }

    win.bodyEl.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.onclick = () => renderTab(btn.dataset.tab);
    });

    renderTab('personalization');
  }

  // ====================================================================
  // 6. CALCULATOR APP
  // ====================================================================
  function openCalcApp() {
    const win = window.SaturnWM.createWindow({
      appId: 'calc',
      title: 'Calculator',
      icon: 'calc',
      width: 320,
      height: 440,
      singleInstance: true,
      contentRenderer: setupCalcWindow
    });
    return win;
  }

  function setupCalcWindow(win) {
    win.bodyEl.innerHTML = `
      <div class="calc-app">
        <div class="calc-display">
          <div class="calc-history"></div>
          <div class="calc-current">0</div>
        </div>
        <div class="calc-keypad">
          <button data-action="clear" class="calc-op">C</button>
          <button data-action="neg" class="calc-op">±</button>
          <button data-action="pct" class="calc-op">%</button>
          <button data-action="op" data-val="/" class="calc-op">÷</button>

          <button data-val="7">7</button>
          <button data-val="8">8</button>
          <button data-val="9">9</button>
          <button data-action="op" data-val="*" class="calc-op">×</button>

          <button data-val="4">4</button>
          <button data-val="5">5</button>
          <button data-val="6">6</button>
          <button data-action="op" data-val="-" class="calc-op">−</button>

          <button data-val="1">1</button>
          <button data-val="2">2</button>
          <button data-val="3">3</button>
          <button data-action="op" data-val="+" class="calc-op">+</button>

          <button data-val="0" style="grid-column: span 2;">0</button>
          <button data-val=".">.</button>
          <button data-action="eq" class="calc-eq">=</button>
        </div>
      </div>
    `;

    const histEl = win.bodyEl.querySelector('.calc-history');
    const curEl = win.bodyEl.querySelector('.calc-current');
    let currentVal = '0';
    let storedVal = null;
    let operator = null;
    let resetOnNextNum = false;

    function update() {
      curEl.textContent = currentVal;
      histEl.textContent = storedVal != null && operator ? `${storedVal} ${operator}` : '';
    }

    win.bodyEl.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const val = btn.dataset.val;
        const action = btn.dataset.action;

        if (val && !action) {
          if (currentVal === '0' || resetOnNextNum) {
            currentVal = val === '.' ? '0.' : val;
            resetOnNextNum = false;
          } else if (val === '.' && currentVal.includes('.')) {
            return;
          } else {
            currentVal += val;
          }
        } else if (action === 'clear') {
          currentVal = '0';
          storedVal = null;
          operator = null;
        } else if (action === 'neg') {
          currentVal = String(-parseFloat(currentVal));
        } else if (action === 'pct') {
          currentVal = String(parseFloat(currentVal) / 100);
        } else if (action === 'op') {
          if (storedVal != null && operator && !resetOnNextNum) {
            calculate();
          } else {
            storedVal = parseFloat(currentVal);
          }
          operator = val;
          resetOnNextNum = true;
        } else if (action === 'eq') {
          if (storedVal != null && operator) {
            calculate();
            operator = null;
            storedVal = null;
            resetOnNextNum = true;
          }
        }
        update();
      };
    });

    function calculate() {
      const a = storedVal;
      const b = parseFloat(currentVal);
      let res = 0;
      if (operator === '+') res = a + b;
      else if (operator === '-') res = a - b;
      else if (operator === '*') res = a * b;
      else if (operator === '/') res = b === 0 ? 'Error' : a / b;
      currentVal = String(typeof res === 'number' ? Math.round(res * 100000000) / 100000000 : res);
    }
  }

  // ====================================================================
  // 7. CLOCK, TIMER & STOPWATCH
  // ====================================================================
  function openClockApp() {
    const win = window.SaturnWM.createWindow({
      appId: 'clock',
      title: 'Clock & Timer',
      icon: 'clock',
      width: 440,
      height: 380,
      singleInstance: true,
      contentRenderer: setupClockWindow
    });
    return win;
  }

  function setupClockWindow(win) {
    win.bodyEl.innerHTML = `
      <div class="clock-app">
        <div class="editor-tabs-bar">
          <div class="editor-tab active" data-tab="clock">Clock</div>
          <div class="editor-tab" data-tab="stopwatch">Stopwatch</div>
          <div class="editor-tab" data-tab="timer">Timer</div>
        </div>
        <div class="clock-tab-content"></div>
      </div>
    `;

    const content = win.bodyEl.querySelector('.clock-tab-content');
    let activeTab = 'clock';
    let timerInterval = null;

    function render() {
      win.bodyEl.querySelectorAll('.editor-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === activeTab);
      });

      if (activeTab === 'clock') {
        content.innerHTML = `
          <div class="big-time-display" id="clock-display">00:00:00</div>
          <div style="color: var(--text-dim); margin-top: 8px;" id="clock-sub">Local Time</div>
        `;
        const clockDisplay = content.querySelector('#clock-display');
        const clockSub = content.querySelector('#clock-sub');
        function tick() {
          const now = new Date();
          clockDisplay.textContent = now.toLocaleTimeString();
          clockSub.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        tick();
        timerInterval = setInterval(tick, 1000);
      } else if (activeTab === 'stopwatch') {
        let startTime = 0;
        let elapsed = 0;
        let running = false;
        let swInterval = null;

        content.innerHTML = `
          <div class="big-time-display" id="sw-display">00:00.00</div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn-primary" id="sw-toggle">Start</button>
            <button id="sw-reset">Reset</button>
          </div>
        `;

        const swDisplay = content.querySelector('#sw-display');
        const swToggle = content.querySelector('#sw-toggle');
        const swReset = content.querySelector('#sw-reset');

        function updateSw() {
          const totalMs = elapsed + (running ? Date.now() - startTime : 0);
          const mins = Math.floor(totalMs / 60000);
          const secs = Math.floor((totalMs % 60000) / 1000);
          const ms = Math.floor((totalMs % 1000) / 10);
          swDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        }

        swToggle.onclick = () => {
          if (!running) {
            running = true;
            startTime = Date.now();
            swToggle.textContent = 'Pause';
            swInterval = setInterval(updateSw, 40);
          } else {
            running = false;
            elapsed += Date.now() - startTime;
            swToggle.textContent = 'Resume';
            clearInterval(swInterval);
          }
        };

        swReset.onclick = () => {
          running = false;
          clearInterval(swInterval);
          elapsed = 0;
          swToggle.textContent = 'Start';
          swDisplay.textContent = '00:00.00';
        };
      } else if (activeTab === 'timer') {
        let duration = 300; // 5 mins
        let remaining = duration;
        let running = false;
        let tmInterval = null;

        content.innerHTML = `
          <div class="big-time-display" id="tm-display">05:00</div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn-primary" id="tm-toggle">Start</button>
            <button id="tm-reset">Reset</button>
          </div>
        `;

        const tmDisplay = content.querySelector('#tm-display');
        const tmToggle = content.querySelector('#tm-toggle');
        const tmReset = content.querySelector('#tm-reset');

        function updateTm() {
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          tmDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          if (remaining <= 0) {
            clearInterval(tmInterval);
            running = false;
            tmToggle.textContent = 'Start';
            toast('Timer Finished', 'Time is up!');
          }
        }

        tmToggle.onclick = () => {
          if (!running) {
            running = true;
            tmToggle.textContent = 'Pause';
            tmInterval = setInterval(() => {
              if (remaining > 0) remaining--;
              updateTm();
            }, 1000);
          } else {
            running = false;
            tmToggle.textContent = 'Resume';
            clearInterval(tmInterval);
          }
        };

        tmReset.onclick = () => {
          running = false;
          clearInterval(tmInterval);
          remaining = duration;
          tmToggle.textContent = 'Start';
          updateTm();
        };
      }
    }

    win.bodyEl.querySelectorAll('.editor-tab').forEach(t => {
      t.onclick = () => {
        clearInterval(timerInterval);
        activeTab = t.dataset.tab;
        render();
      };
    });

    render();
    win.onClose = () => clearInterval(timerInterval);
  }

  // ====================================================================
  // 8. CALENDAR APP
  // ====================================================================
  function openCalendarApp() {
    const win = window.SaturnWM.createWindow({
      appId: 'calendar',
      title: 'Calendar',
      icon: 'calendar',
      width: 360,
      height: 380,
      singleInstance: true,
      contentRenderer: setupCalendarWindow
    });
    return win;
  }

  function setupCalendarWindow(win) {
    let viewDate = new Date();

    win.bodyEl.innerHTML = `
      <div class="calendar-app">
        <div class="calendar-header">
          <span style="font-weight: 600; font-size: 15px;" id="cal-title"></span>
          <div style="display: flex; gap: 4px;">
            <button id="cal-prev" title="Previous Month">${window.SaturnIcons.svg('back')}</button>
            <button id="cal-today">Today</button>
            <button id="cal-next" title="Next Month">${window.SaturnIcons.svg('forward')}</button>
          </div>
        </div>
        <div class="calendar-grid"></div>
      </div>
    `;

    const titleEl = win.bodyEl.querySelector('#cal-title');
    const gridEl = win.bodyEl.querySelector('.calendar-grid');

    function renderCal() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      titleEl.textContent = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();

      const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');

      // Leading empty cells
      for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-cell other-month"></div>`;
      }

      // Day cells
      for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        html += `<div class="cal-cell ${isToday ? 'today' : ''}">${day}</div>`;
      }

      gridEl.innerHTML = html;
    }

    win.bodyEl.querySelector('#cal-prev').onclick = () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      renderCal();
    };

    win.bodyEl.querySelector('#cal-next').onclick = () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      renderCal();
    };

    win.bodyEl.querySelector('#cal-today').onclick = () => {
      viewDate = new Date();
      renderCal();
    };

    renderCal();
  }

  return {
    open,
    REGISTRY
  };
})();
