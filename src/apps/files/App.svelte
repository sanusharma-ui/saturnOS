<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api, type FileItem, type FsInfo } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';
  import { contextMenuStore } from '../../core/contextmenu/store';
  import { getIconSvg } from '../../assets/icons/icons';
  import { appRegistry } from '../../core/registry/appRegistry';
  import { openApp } from '../../core/wm/manager';

  interface Props {
    arg?: any;
    initialPath?: string;
  }

  let { arg, initialPath }: Props = $props();

  let fsInfo = $state<FsInfo | null>(null);
  let currentPath = $state<string>('');
  let items = $state<FileItem[]>([]);
  let history = $state<string[]>([]);
  let historyIdx = $state(0);
  let isGrid = $state(true);
  let filterText = $state('');
  let selectedName = $state<string | null>(null);
  let showHidden = $state(false);
  let isEditingAddress = $state(false);
  let addressInputVal = $state('');
  let showNewMenu = $state(false);

  // Sorting
  type SortField = 'name' | 'size' | 'mtime' | 'type';
  let sortField = $state<SortField>('name');
  let sortAsc = $state(true);

  // App Clipboard for Cut/Copy/Paste
  let clipboard = $state<{ op: 'copy' | 'cut'; item: FileItem } | null>(null);

  // Rename Dialog State
  let renameModal = $state<{ open: boolean; item: FileItem | null; newName: string }>({
    open: false,
    item: null,
    newName: ''
  });

  // Properties Dialog State
  let propertiesModal = $state<{ open: boolean; item: FileItem | null }>({
    open: false,
    item: null
  });

  // Derived Paths
  let HOME = $derived(fsInfo?.home || '/home/sanu');
  let DESKTOP = $derived(fsInfo?.desktop || `${HOME}/Desktop`);
  let DOCUMENTS = $derived(fsInfo?.documents || `${HOME}/Documents`);
  let DOWNLOADS = $derived(fsInfo?.downloads || `${HOME}/Downloads`);
  let PICTURES = $derived(fsInfo?.pictures || `${HOME}/Pictures`);
  let MUSIC = $derived(fsInfo?.music || `${HOME}/Music`);
  let VIDEOS = $derived(fsInfo?.videos || `${HOME}/Videos`);
  let TRASH = $derived(fsInfo?.trash || `${HOME}/.saturn-trash`);

  let isTrash = $derived(currentPath === TRASH);

  let filteredItems = $derived.by(() => {
    let list = items.filter(i => !filterText || i.name.toLowerCase().includes(filterText.toLowerCase()));

    list.sort((a, b) => {
      // Directories first
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;

      let res = 0;
      if (sortField === 'name') {
        res = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortField === 'size') {
        res = (a.size || 0) - (b.size || 0);
      } else if (sortField === 'mtime') {
        res = (a.mtime || 0) - (b.mtime || 0);
      } else if (sortField === 'type') {
        res = (a.ext || '').localeCompare(b.ext || '');
      }
      return sortAsc ? res : -res;
    });

    return list;
  });

  let breadcrumbs = $derived.by(() => {
    if (!currentPath) return [];
    // Normalize path separators to forward slashes for display
    const normalized = currentPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts;
  });

  async function init() {
    const info = await api.fsInfo();
    if (info) {
      fsInfo = info;
    }
    const resolvedStart = (typeof arg === 'string' && arg.trim()) || initialPath || fsInfo?.home || '~';
    await loadDir(resolvedStart, true);
  }

  async function loadDir(path: string, record = true) {
    try {
      const res = await api.listFiles(path, showHidden);
      currentPath = res.path;
      items = res.items || [];
      selectedName = null;
      addressInputVal = res.path;
      isEditingAddress = false;

      if (record) {
        history = history.slice(0, historyIdx + 1);
        history.push(currentPath);
        historyIdx = history.length - 1;
      }
    } catch (err: any) {
      showToast('Files Error', err.message);
    }
  }

  function goBack() {
    if (historyIdx > 0) {
      historyIdx--;
      loadDir(history[historyIdx], false);
    }
  }

  function goForward() {
    if (historyIdx < history.length - 1) {
      historyIdx++;
      loadDir(history[historyIdx], false);
    }
  }

  function goUp() {
    if (currentPath === HOME) return;
    const isWin = fsInfo?.platform === 'win32';
    const sep = isWin ? '\\' : '/';
    const lastSlash = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
    if (lastSlash > 0) {
      const parent = currentPath.substring(0, lastSlash);
      loadDir(parent);
    } else {
      loadDir(HOME);
    }
  }

  function getItemIcon(item: FileItem) {
    if (item.type === 'dir') return 'folder';
    const ext = item.ext || item.name.split('.').pop()?.toLowerCase() || '';
    if (/^(png|jpe?g|webp|gif|svg|ico|bmp)$/.test(ext)) return 'file-image';
    if (/^(mp3|wav|ogg|flac|m4a|aac)$/.test(ext)) return 'file-audio';
    if (/^(mp4|webm|mkv|avi|mov)$/.test(ext)) return 'file-video';
    if (/^(js|ts|html|css|json|py|sh|bat|cmd|c|cpp|h|md|txt|log|xml|yaml|yml)$/.test(ext)) return 'file-code';
    return 'file';
  }

  function formatBytes(bytes?: number) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function handleOpenItem(item: FileItem) {
    const full = item.path;
    if (item.type === 'dir') {
      loadDir(full);
    } else {
      const ext = item.ext || item.name.split('.').pop()?.toLowerCase() || '';
      if (/^(png|jpe?g|webp|gif|svg|ico|bmp|mp3|wav|ogg|flac|m4a|mp4|webm)$/.test(ext)) {
        const viewerManifest = appRegistry.get('viewer');
        if (viewerManifest) openApp(viewerManifest, full);
      } else {
        const editorManifest = appRegistry.get('editor');
        if (editorManifest) openApp(editorManifest, full);
      }
    }
  }

  // Real PC File Creation
  async function handleCreate(type: 'file' | 'dir', defaultName?: string, content = '') {
    try {
      showNewMenu = false;
      const res = await api.createItem(currentPath, type, defaultName, content);
      await loadDir(currentPath, false);
      selectedName = res.name;
      showToast('Created', `"${res.name}" created successfully`);
      
      // If it's a new file and user wants to edit, open editor
      if (type === 'file' && defaultName && defaultName.endsWith('.txt')) {
        const m = appRegistry.get('editor');
        if (m) openApp(m, res.path);
      }
    } catch (err: any) {
      showToast('Creation Failed', err.message);
    }
  }

  // Renaming
  function openRenameDialog(item: FileItem) {
    renameModal = {
      open: true,
      item,
      newName: item.name
    };
  }

  async function submitRename() {
    if (!renameModal.item || !renameModal.newName.trim()) return;
    try {
      const newName = renameModal.newName.trim();
      await api.rename(renameModal.item.path, newName);
      renameModal.open = false;
      await loadDir(currentPath, false);
      selectedName = newName;
      showToast('Renamed', `Renamed to "${newName}"`);
    } catch (err: any) {
      showToast('Rename Failed', err.message);
    }
  }

  // Deleting & Trash
  async function handleDelete(item: FileItem, permanent = false) {
    try {
      await api.deleteItem(item.path, false, permanent);
      await loadDir(currentPath, false);
      showToast(permanent ? 'Deleted' : 'Moved to Trash', item.name);
    } catch (err: any) {
      showToast('Delete Failed', err.message);
    }
  }

  async function handleRestore(item: FileItem) {
    try {
      const res = await api.restoreItem(item.path);
      await loadDir(currentPath, false);
      showToast('Restored', `Restored to ${res.path}`);
    } catch (err: any) {
      showToast('Restore Failed', err.message);
    }
  }

  async function handleDuplicate(item: FileItem) {
    try {
      const res = await api.duplicateItem(item.path);
      await loadDir(currentPath, false);
      selectedName = res.name;
      showToast('Duplicated', `Created "${res.name}"`);
    } catch (err: any) {
      showToast('Duplicate Failed', err.message);
    }
  }

  // Clipboard operations
  function handleCut(item: FileItem) {
    clipboard = { op: 'cut', item };
    showToast('Cut', `"${item.name}" copied to clipboard`);
  }

  function handleCopy(item: FileItem) {
    clipboard = { op: 'copy', item };
    showToast('Copied', `"${item.name}" copied to clipboard`);
  }

  async function handlePaste() {
    if (!clipboard) return;
    try {
      if (clipboard.op === 'cut') {
        await api.moveItem(clipboard.item.path, currentPath);
        clipboard = null;
      } else {
        await api.copyItem(clipboard.item.path, currentPath);
      }
      await loadDir(currentPath, false);
      showToast('Pasted', 'Item placed in current folder');
    } catch (err: any) {
      showToast('Paste Failed', err.message);
    }
  }

  function openProperties(item: FileItem) {
    propertiesModal = {
      open: true,
      item
    };
  }

  function handleOpenTerminalHere(path = currentPath) {
    const term = appRegistry.get('terminal');
    if (term) openApp(term, { cwd: path });
  }

  // Context Menu
  function handleItemContextMenu(e: MouseEvent, item: FileItem) {
    e.preventDefault();
    e.stopPropagation();
    selectedName = item.name;

    if (isTrash) {
      contextMenuStore.open(e.clientX, e.clientY, [
        { label: 'Restore', icon: 'refresh', action: () => handleRestore(item) },
        { label: 'Delete Permanently', icon: 'trash', action: () => handleDelete(item, true) },
        { separator: true },
        { label: 'Properties', icon: 'info', action: () => openProperties(item) }
      ]);
      return;
    }

    contextMenuStore.open(e.clientX, e.clientY, [
      { label: 'Open', icon: 'folder', action: () => handleOpenItem(item) },
      {
        label: 'Open With',
        icon: 'editor',
        action: () => {},
        submenu: [
          { label: 'Text Editor', action: () => { const m = appRegistry.get('editor'); if (m) openApp(m, item.path); } },
          { label: 'Media Viewer', action: () => { const m = appRegistry.get('viewer'); if (m) openApp(m, item.path); } },
          { label: 'Terminal here', action: () => handleOpenTerminalHere(item.type === 'dir' ? item.path : currentPath) }
        ]
      },
      { separator: true },
      { label: 'Cut', icon: 'cut', shortcut: 'Ctrl+X', action: () => handleCut(item) },
      { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', action: () => handleCopy(item) },
      { label: 'Duplicate', icon: 'copy', action: () => handleDuplicate(item) },
      { label: 'Rename', icon: 'edit', shortcut: 'F2', action: () => openRenameDialog(item) },
      { separator: true },
      { label: 'Move to Trash', icon: 'trash', shortcut: 'Del', action: () => handleDelete(item, false) },
      { label: 'Delete Permanently', icon: 'close', action: () => handleDelete(item, true) },
      { separator: true },
      { label: 'Properties', icon: 'info', shortcut: 'Alt+Enter', action: () => openProperties(item) }
    ]);
  }

  function handleBackgroundContextMenu(e: MouseEvent) {
    e.preventDefault();
    selectedName = null;

    if (isTrash) {
      contextMenuStore.open(e.clientX, e.clientY, [
        {
          label: 'Empty Trash',
          icon: 'trash',
          action: () => {
            api.deleteItem('', true).then(() => {
              showToast('Trash', 'Emptied all items');
              loadDir(TRASH, false);
            }).catch(err => showToast('Error', err.message));
          }
        },
        { label: 'Refresh', icon: 'refresh', action: () => loadDir(currentPath, false) }
      ]);
      return;
    }

    contextMenuStore.open(e.clientX, e.clientY, [
      {
        label: 'New',
        icon: 'plus',
        action: () => {},
        submenu: [
          { label: 'Folder', action: () => handleCreate('dir', 'New Folder') },
          { label: 'Text Document (.txt)', action: () => handleCreate('file', 'New Text Document.txt') },
          { label: 'Markdown Document (.md)', action: () => handleCreate('file', 'New Document.md') },
          { label: 'Script File (.sh)', action: () => handleCreate('file', 'script.sh', '#!/bin/sh\n') },
          { label: 'Batch File (.bat)', action: () => handleCreate('file', 'script.bat', '@echo off\n') }
        ]
      },
      { separator: true },
      {
        label: 'Paste',
        icon: 'editor',
        shortcut: 'Ctrl+V',
        disabled: !clipboard,
        action: handlePaste
      },
      { separator: true },
      { label: 'Open Terminal Here', icon: 'terminal', action: () => handleOpenTerminalHere(currentPath) },
      {
        label: showHidden ? 'Hide Hidden Files' : 'Show Hidden Files',
        icon: 'view-list',
        action: () => { showHidden = !showHidden; loadDir(currentPath, false); }
      },
      { label: 'Refresh', icon: 'refresh', shortcut: 'F5', action: () => loadDir(currentPath, false) }
    ]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (renameModal.open || propertiesModal.open) return;

    if (e.key === 'F2' && selectedName) {
      const item = items.find(i => i.name === selectedName);
      if (item) {
        e.preventDefault();
        openRenameDialog(item);
      }
    } else if (e.key === 'Delete' && selectedName) {
      const item = items.find(i => i.name === selectedName);
      if (item) {
        e.preventDefault();
        handleDelete(item, e.shiftKey);
      }
    } else if (e.key === 'Enter' && selectedName) {
      const item = items.find(i => i.name === selectedName);
      if (item) {
        e.preventDefault();
        handleOpenItem(item);
      }
    } else if (e.key === 'Backspace' && !isEditingAddress) {
      e.preventDefault();
      goUp();
    } else if (e.ctrlKey && e.key === 'c' && selectedName) {
      const item = items.find(i => i.name === selectedName);
      if (item) handleCopy(item);
    } else if (e.ctrlKey && e.key === 'x' && selectedName) {
      const item = items.find(i => i.name === selectedName);
      if (item) handleCut(item);
    } else if (e.ctrlKey && e.key === 'v') {
      handlePaste();
    }
  }

  function handleAddressSubmit(e: SubmitEvent | KeyboardEvent) {
    if ('key' in e && e.key !== 'Enter') return;
    if (addressInputVal.trim()) {
      loadDir(addressInputVal.trim());
    }
  }

  onMount(() => {
    init();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
  class="files-app"
  tabindex="0"
  role="region"
  aria-label="File Explorer"
  onkeydown={handleKeyDown}
>
  <!-- Toolbar -->
  <header class="files-toolbar">
    <div class="files-nav-btns">
      <button type="button" class="icon-btn" onclick={goBack} disabled={historyIdx <= 0} title="Back (Alt+Left)">
        {@html getIconSvg('back')}
      </button>
      <button type="button" class="icon-btn" onclick={goForward} disabled={historyIdx >= history.length - 1} title="Forward (Alt+Right)">
        {@html getIconSvg('forward')}
      </button>
      <button type="button" class="icon-btn" onclick={goUp} disabled={currentPath === HOME} title="Up (Backspace / Alt+Up)">
        {@html getIconSvg('up')}
      </button>
    </div>

    <!-- Address / Breadcrumbs Bar -->
    <div class="files-breadcrumbs-wrapper">
      {#if isEditingAddress}
        <input
          type="text"
          class="files-address-input"
          bind:value={addressInputVal}
          onkeydown={handleAddressSubmit}
          onblur={() => (isEditingAddress = false)}
          placeholder="Enter path..."
          autofocus
        />
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="files-breadcrumbs" onclick={() => (isEditingAddress = true)}>
          <button type="button" class="files-crumb-chip root-chip" onclick={(e) => { e.stopPropagation(); loadDir(HOME); }}>
            ~
          </button>
          {#each breadcrumbs as crumb, i}
            <span class="files-crumb-sep">/</span>
            <button
              type="button"
              class="files-crumb-chip"
              onclick={(e) => {
                e.stopPropagation();
                const isWin = fsInfo?.platform === 'win32';
                const prefix = isWin ? '' : '/';
                loadDir(prefix + breadcrumbs.slice(0, i + 1).join('/'));
              }}
            >
              {crumb}
            </button>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        class="address-edit-toggle"
        onclick={() => (isEditingAddress = !isEditingAddress)}
        title="Toggle address bar text edit"
      >
        {@html getIconSvg('edit')}
      </button>
    </div>

    <!-- Filter input -->
    <input
      type="text"
      placeholder="Filter files..."
      bind:value={filterText}
      class="files-filter-input"
    />

    <!-- Action Buttons -->
    <div class="files-actions-group">
      <!-- "New" Menu Button -->
      <div class="new-menu-wrapper">
        <button
          type="button"
          class="btn-primary new-btn"
          onclick={() => (showNewMenu = !showNewMenu)}
          title="Create New Item"
        >
          {@html getIconSvg('plus', 1.4)} New
        </button>
        {#if showNewMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="new-dropdown" onclick={() => (showNewMenu = false)}>
            <button type="button" onclick={() => handleCreate('dir', 'New Folder')}>
              {@html getIconSvg('folder')} New Folder
            </button>
            <button type="button" onclick={() => handleCreate('file', 'New Text Document.txt')}>
              {@html getIconSvg('file')} Text Document (.txt)
            </button>
            <button type="button" onclick={() => handleCreate('file', 'New Document.md')}>
              {@html getIconSvg('file-code')} Markdown Document (.md)
            </button>
            <button type="button" onclick={() => handleCreate('file', 'script.sh', '#!/bin/sh\n')}>
              {@html getIconSvg('file-code')} Shell Script (.sh)
            </button>
            <button type="button" onclick={() => handleCreate('file', 'script.bat', '@echo off\n')}>
              {@html getIconSvg('file-code')} Batch Script (.bat)
            </button>
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="icon-btn"
        onclick={() => (isGrid = !isGrid)}
        title={isGrid ? 'Switch to List View' : 'Switch to Grid View'}
      >
        {@html getIconSvg(isGrid ? 'view-grid' : 'view-list')}
      </button>

      <button
        type="button"
        class="icon-btn"
        onclick={() => handleOpenTerminalHere()}
        title="Open Terminal in this folder"
      >
        {@html getIconSvg('terminal')}
      </button>

      {#if isTrash}
        <button
          type="button"
          class="icon-btn danger"
          onclick={() => {
            if (confirm('Permanently empty all items in Trash?')) {
              api.deleteItem('', true).then(() => {
                showToast('Trash Emptied', 'All items deleted');
                loadDir(TRASH, false);
              }).catch(err => showToast('Error', err.message));
            }
          }}
          title="Empty Trash"
        >
          {@html getIconSvg('trash')}
        </button>
      {/if}
    </div>
  </header>

  <!-- Body -->
  <div class="files-body">
    <!-- Sidebar -->
    <nav class="files-sidebar">
      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === HOME}
        onclick={() => loadDir(HOME)}
      >
        {@html getIconSvg('home')} <span>Home</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === DESKTOP}
        onclick={() => loadDir(DESKTOP)}
      >
        {@html getIconSvg('grid')} <span>Desktop</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === DOCUMENTS}
        onclick={() => loadDir(DOCUMENTS)}
      >
        {@html getIconSvg('file')} <span>Documents</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === DOWNLOADS}
        onclick={() => loadDir(DOWNLOADS)}
      >
        {@html getIconSvg('forward')} <span>Downloads</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === PICTURES}
        onclick={() => loadDir(PICTURES)}
      >
        {@html getIconSvg('file-image')} <span>Pictures</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === MUSIC}
        onclick={() => loadDir(MUSIC)}
      >
        {@html getIconSvg('file-audio')} <span>Music</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item"
        class:active={currentPath === VIDEOS}
        onclick={() => loadDir(VIDEOS)}
      >
        {@html getIconSvg('file-video')} <span>Videos</span>
      </button>

      <button
        type="button"
        class="files-sidebar-item trash-item"
        class:active={isTrash}
        onclick={() => loadDir(TRASH)}
      >
        {@html getIconSvg('trash')} <span>Trash</span>
      </button>
    </nav>

    <!-- Content View -->
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <main
      class="files-content-view {isGrid ? 'grid-mode' : 'list-mode'}"
      onclick={() => (selectedName = null)}
      oncontextmenu={handleBackgroundContextMenu}
    >
      {#if filteredItems.length === 0}
        <div class="empty-folder-msg">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px; color: var(--text-dim); opacity: 0.5;">
            {@html getIconSvg(isTrash ? 'trash' : 'folder')}
          </div>
          <div>{isTrash ? 'Trash is empty' : 'This folder is empty'}</div>
          {#if !isTrash}
            <button
              type="button"
              class="btn-primary"
              style="margin-top: 12px; font-size: 12px; padding: 6px 14px;"
              onclick={() => handleCreate('dir', 'New Folder')}
            >
              + Create Folder
            </button>
          {/if}
        </div>
      {:else if isGrid}
        {#each filteredItems as item (item.path)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="file-entry"
            class:selected={selectedName === item.name}
            onclick={(e) => { e.stopPropagation(); selectedName = item.name; }}
            ondblclick={() => handleOpenItem(item)}
            oncontextmenu={(e) => handleItemContextMenu(e, item)}
          >
            <div class="icon-badge badge-{getItemIcon(item)}">
              {@html getIconSvg(getItemIcon(item))}
            </div>
            <span class="name" title={item.name}>{item.name}</span>
          </div>
        {/each}
      {:else}
        <table class="files-table">
          <thead>
            <tr>
              <th onclick={() => { if (sortField === 'name') sortAsc = !sortAsc; else { sortField = 'name'; sortAsc = true; } }}>
                Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onclick={() => { if (sortField === 'size') sortAsc = !sortAsc; else { sortField = 'size'; sortAsc = true; } }}>
                Size {sortField === 'size' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onclick={() => { if (sortField === 'type') sortAsc = !sortAsc; else { sortField = 'type'; sortAsc = true; } }}>
                Type {sortField === 'type' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onclick={() => { if (sortField === 'mtime') sortAsc = !sortAsc; else { sortField = 'mtime'; sortAsc = true; } }}>
                Modified {sortField === 'mtime' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item.path)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <tr
                class="file-entry-row"
                class:selected={selectedName === item.name}
                onclick={(e) => { e.stopPropagation(); selectedName = item.name; }}
                ondblclick={() => handleOpenItem(item)}
                oncontextmenu={(e) => handleItemContextMenu(e, item)}
              >
                <td class="name-cell">
                  <span class="table-icon">{@html getIconSvg(getItemIcon(item))}</span>
                  <span class="table-name">{item.name}</span>
                </td>
                <td>{item.type === 'dir' ? '—' : formatBytes(item.size)}</td>
                <td>{item.type === 'dir' ? 'Folder' : (item.ext?.toUpperCase() || 'File')}</td>
                <td>{item.mtime ? new Date(item.mtime).toLocaleString() : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </main>
  </div>

  <!-- Status Bar -->
  <footer class="files-status-bar">
    <span>{filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}</span>
    {#if selectedName}
      {@const sel = items.find(i => i.name === selectedName)}
      {#if sel}
        <span class="status-sep">•</span>
        <span>Selected: {sel.name} {sel.size ? `(${formatBytes(sel.size)})` : ''}</span>
      {/if}
    {/if}
    {#if clipboard}
      <span class="status-sep">•</span>
      <span class="clipboard-tag">{clipboard.op.toUpperCase()}: {clipboard.item.name}</span>
    {/if}
  </footer>

  <!-- Rename Modal -->
  {#if renameModal.open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => (renameModal.open = false)}>
      <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Rename Item</h3>
          <button type="button" class="close-x" onclick={() => (renameModal.open = false)}>×</button>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); submitRename(); }}>
          <div class="modal-body">
            <label for="rename-input">Enter new name:</label>
            <input
              id="rename-input"
              type="text"
              class="modal-input"
              bind:value={renameModal.newName}
              autofocus
            />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (renameModal.open = false)}>Cancel</button>
            <button type="submit" class="btn-primary">Rename</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Properties Modal -->
  {#if propertiesModal.open && propertiesModal.item}
    {@const item = propertiesModal.item}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => (propertiesModal.open = false)}>
      <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Properties</h3>
          <button type="button" class="close-x" onclick={() => (propertiesModal.open = false)}>×</button>
        </div>
        <div class="modal-body properties-body">
          <div class="prop-icon-area">
            <div class="icon-badge badge-{getItemIcon(item)}" style="margin: 0 auto 10px;">
              {@html getIconSvg(getItemIcon(item))}
            </div>
            <strong>{item.name}</strong>
          </div>
          <div class="prop-row">
            <span class="prop-lbl">Type:</span>
            <span>{item.type === 'dir' ? 'Folder' : (item.ext?.toUpperCase() ? `${item.ext.toUpperCase()} File` : 'File')}</span>
          </div>
          <div class="prop-row">
            <span class="prop-lbl">Location:</span>
            <span class="prop-path" title={item.path}>{item.path}</span>
          </div>
          <div class="prop-row">
            <span class="prop-lbl">Size:</span>
            <span>{item.type === 'dir' ? '—' : `${formatBytes(item.size)} (${item.size || 0} bytes)`}</span>
          </div>
          <div class="prop-row">
            <span class="prop-lbl">Modified:</span>
            <span>{item.mtime ? new Date(item.mtime).toLocaleString() : '—'}</span>
          </div>
          {#if item.originalPath}
            <div class="prop-row">
              <span class="prop-lbl">Original:</span>
              <span class="prop-path">{item.originalPath}</span>
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-primary" onclick={() => (propertiesModal.open = false)}>Close</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .files-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--bg-window, #1e1e24);
    color: var(--text-primary, #e2e8f0);
    outline: none;
  }

  /* Toolbar */
  .files-toolbar {
    height: 42px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--surface-1, rgba(255, 255, 255, 0.03));
    flex: none;
  }

  .files-nav-btns {
    display: flex;
    gap: 3px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-dim, #94a3b8);
    cursor: pointer;
    transition: all 0.15s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--surface-2, rgba(255, 255, 255, 0.08));
    color: #ffffff;
  }

  .icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  :global(.icon-btn svg) {
    width: 15px;
    height: 15px;
  }

  /* Breadcrumbs */
  .files-breadcrumbs-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--surface-solid, rgba(0, 0, 0, 0.25));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    height: 28px;
    padding: 0 4px 0 8px;
    overflow: hidden;
  }

  .files-breadcrumbs {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 12px;
    height: 100%;
    cursor: text;
  }

  .files-crumb-chip {
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-dim, #94a3b8);
    background: transparent;
    border: none;
    font-size: inherit;
    font-family: inherit;
    transition: all 0.1s;
  }

  .files-crumb-chip:hover {
    background: var(--surface-2, rgba(255, 255, 255, 0.1));
    color: #ffffff;
  }

  .files-crumb-chip.root-chip {
    font-weight: 700;
  }

  .files-crumb-sep {
    color: var(--text-muted, #64748b);
    user-select: none;
    font-size: 11px;
  }

  .files-address-input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 12px;
    font-family: inherit;
  }

  .address-edit-toggle {
    background: transparent;
    border: none;
    color: var(--text-dim, #94a3b8);
    padding: 2px;
    cursor: pointer;
    opacity: 0.6;
    display: flex;
    align-items: center;
  }

  .address-edit-toggle:hover {
    opacity: 1;
  }

  :global(.address-edit-toggle svg) {
    width: 12px;
    height: 12px;
  }

  .files-filter-input {
    width: 130px;
    height: 28px;
    padding: 2px 8px;
    font-size: 11.5px;
    background: var(--surface-solid, rgba(0, 0, 0, 0.25));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    color: #ffffff;
    outline: none;
  }

  .files-filter-input:focus {
    border-color: var(--accent, #3b82f6);
  }

  /* Actions Group & "New" Button */
  .files-actions-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .new-menu-wrapper {
    position: relative;
  }

  .new-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    padding: 4px 10px;
    height: 28px;
  }

  .new-dropdown {
    position: absolute;
    top: 34px;
    right: 0;
    background: #252830;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    min-width: 190px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .new-dropdown button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #e2e8f0;
    padding: 7px 10px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    font-family: inherit;
    transition: background 0.1s;
  }

  .new-dropdown button:hover {
    background: #3b82f6;
    color: #ffffff;
  }

  :global(.new-dropdown svg) {
    width: 16px;
    height: 16px;
  }

  /* Body */
  .files-body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .files-sidebar {
    width: 155px;
    border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--surface-1, rgba(255, 255, 255, 0.02));
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: none;
    user-select: none;
  }

  .files-sidebar-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim, #94a3b8);
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
    transition: all 0.12s ease;
  }

  .files-sidebar-item:hover {
    background: var(--surface-2, rgba(255, 255, 255, 0.07));
    color: #ffffff;
  }

  .files-sidebar-item.active {
    background: var(--accent, #3b82f6);
    color: #ffffff;
    font-weight: 500;
  }

  .files-sidebar-item.trash-item {
    margin-top: auto;
  }

  :global(.files-sidebar-item svg) {
    width: 16px;
    height: 16px;
    flex: none;
  }

  /* Content View */
  .files-content-view {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .files-content-view.grid-mode {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 10px;
  }

  .file-entry {
    width: 96px;
    padding: 8px 6px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    text-align: center;
    user-select: none;
    transition: all 0.1s;
  }

  .file-entry:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .file-entry.selected {
    background: color-mix(in srgb, var(--accent, #3b82f6) 30%, transparent);
    outline: 1px solid var(--accent, #3b82f6);
  }

  .icon-badge {
    width: 46px;
    height: 46px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  }

  :global(.icon-badge svg) {
    width: 26px;
    height: 26px;
  }

  .badge-folder { background: linear-gradient(145deg, #4f8eff, #2563eb); color: #fff; }
  .badge-file { background: linear-gradient(145deg, #64748b, #475569); color: #fff; }
  .badge-file-image { background: linear-gradient(145deg, #c084fc, #9333ea); color: #fff; }
  .badge-file-audio { background: linear-gradient(145deg, #fbbf24, #d97706); color: #fff; }
  .badge-file-video { background: linear-gradient(145deg, #f87171, #dc2626); color: #fff; }
  .badge-file-code { background: linear-gradient(145deg, #38bdf8, #0284c7); color: #fff; }

  .name {
    font-size: 11.5px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
    color: var(--text-primary, #e2e8f0);
  }

  /* Table List View */
  .files-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .files-table th {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
    color: var(--text-dim, #94a3b8);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }

  .files-table th:hover {
    color: #fff;
  }

  .files-table td {
    padding: 7px 10px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .file-entry-row {
    cursor: pointer;
    user-select: none;
  }

  .file-entry-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .file-entry-row.selected {
    background: color-mix(in srgb, var(--accent, #3b82f6) 30%, transparent);
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .table-icon {
    width: 18px;
    height: 18px;
    display: inline-flex;
    flex: none;
  }

  .table-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-folder-msg {
    color: var(--text-muted, #64748b);
    padding: 60px 20px;
    text-align: center;
    width: 100%;
  }

  /* Status Bar */
  .files-status-bar {
    height: 24px;
    background: var(--surface-1, rgba(255, 255, 255, 0.03));
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-dim, #94a3b8);
    gap: 8px;
  }

  .status-sep {
    color: var(--text-muted, #64748b);
  }

  .clipboard-tag {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 10px;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal-dialog {
    background: #21252b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    width: 380px;
    max-width: 90vw;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .close-x {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
  }

  .modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }

  .modal-input {
    width: 100%;
    height: 32px;
    background: #181a1f;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 0 10px;
    color: #fff;
    font-size: 13px;
    outline: none;
  }

  .modal-input:focus {
    border-color: #3b82f6;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.15);
  }

  .btn-primary {
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-cancel {
    background: transparent;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .properties-body {
    gap: 12px;
  }

  .prop-icon-area {
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .prop-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  .prop-lbl {
    color: #94a3b8;
    flex: none;
    width: 70px;
  }

  .prop-path {
    word-break: break-all;
    text-align: right;
  }
</style>
