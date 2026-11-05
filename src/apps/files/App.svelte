<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type FileItem } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';
  import { openContextMenu } from '../../core/contextmenu/store';
  import { getIconSvg } from '../../assets/icons/icons';
  import { appRegistry } from '../../core/registry/appRegistry';
  import { openApp } from '../../core/wm/manager';

  export let arg: string | undefined = undefined;

  const HOME = '/home/sanu';
  const DESKTOP = `${HOME}/Desktop`;
  const TRASH = `${HOME}/.saturn-trash`;

  let currentPath = arg && typeof arg === 'string' && arg.startsWith('/') ? arg : HOME;
  let items: FileItem[] = [];
  let history: string[] = [currentPath];
  let historyIdx = 0;
  let isGrid = true;
  let filterText = '';
  let selectedName: string | null = null;

  $: filteredItems = items.filter(i => !filterText || i.name.toLowerCase().includes(filterText.toLowerCase()));
  $: breadcrumbs = currentPath.split('/').filter(Boolean);
  $: isTrash = currentPath === TRASH;

  async function loadDir(path: string, record = true) {
    try {
      const res = await api.listFiles(path);
      currentPath = res.path;
      items = res.items || [];
      selectedName = null;

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
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || HOME;
    loadDir(parent);
  }

  function getItemIcon(item: FileItem) {
    if (item.type === 'dir') return 'folder';
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    if (/^(png|jpe?g|webp|gif|svg)$/.test(ext)) return 'file-image';
    if (/^(mp3|wav|ogg|flac|m4a)$/.test(ext)) return 'file-audio';
    if (/^(mp4|webm)$/.test(ext)) return 'file-video';
    if (/^(js|ts|html|css|json|py|sh|c|h|md)$/.test(ext)) return 'file-code';
    return 'file';
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function handleOpenItem(item: FileItem) {
    const full = `${currentPath}/${item.name}`;
    if (item.type === 'dir') {
      loadDir(full);
    } else {
      const ext = item.name.split('.').pop()?.toLowerCase() || '';
      if (/^(png|jpe?g|webp|gif|svg|mp3|wav|ogg|flac|m4a|mp4|webm)$/.test(ext)) {
        const viewerManifest = appRegistry.get('viewer');
        if (viewerManifest) openApp(viewerManifest, full);
      } else {
        const editorManifest = appRegistry.get('editor');
        if (editorManifest) openApp(editorManifest, full);
      }
    }
  }

  function handleContextMenu(e: MouseEvent, item?: FileItem) {
    e.preventDefault();
    e.stopPropagation();

    if (item) {
      selectedName = item.name;
      const full = `${currentPath}/${item.name}`;
      openContextMenu(e.clientX, e.clientY, [
        { label: 'Open', action: () => handleOpenItem(item) },
        {
          label: 'Open With',
          submenu: [
            { label: 'Text Editor', action: () => { const m = appRegistry.get('editor'); if (m) openApp(m, full); } },
            { label: 'Media Viewer', action: () => { const m = appRegistry.get('viewer'); if (m) openApp(m, full); } },
            { label: 'Terminal here', action: () => { const m = appRegistry.get('terminal'); if (m) openApp(m, item.type === 'dir' ? full : currentPath); } }
          ]
        },
        { separator: true },
        { label: 'Delete', action: () => api.deleteItem(full).then(() => loadDir(currentPath, false)).catch(err => showToast('Error', err.message)) }
      ]);
    } else {
      openContextMenu(e.clientX, e.clientY, [
        {
          label: 'New Folder',
          action: () => {
            const name = prompt('New Folder Name:', 'New Folder');
            if (name) api.mkdir(currentPath, name).then(() => loadDir(currentPath, false)).catch(err => showToast('Error', err.message));
          }
        },
        {
          label: 'New Text File',
          action: () => {
            const name = prompt('New File Name:', 'untitled.txt');
            if (name) api.writeFile(`${currentPath}/${name}`, '').then(() => loadDir(currentPath, false)).catch(err => showToast('Error', err.message));
          }
        },
        { separator: true },
        { label: 'Refresh', action: () => loadDir(currentPath, false) },
        { label: 'Open Terminal here', action: () => { const m = appRegistry.get('terminal'); if (m) openApp(m, currentPath); } }
      ]);
    }
  }

  onMount(() => {
    loadDir(currentPath, true);
  });
</script>

<div class="files-app">
  <!-- Toolbar -->
  <div class="files-toolbar">
    <div class="files-nav-btns">
      <button class="icon-btn" on:click={goBack} disabled={historyIdx <= 0} title="Back">
        {@html getIconSvg('back')}
      </button>
      <button class="icon-btn" on:click={goForward} disabled={historyIdx >= history.length - 1} title="Forward">
        {@html getIconSvg('forward')}
      </button>
      <button class="icon-btn" on:click={goUp} disabled={currentPath === HOME} title="Up">
        {@html getIconSvg('up')}
      </button>
    </div>

    <!-- Breadcrumbs -->
    <div class="files-breadcrumbs">
      <span class="files-crumb-chip" on:click={() => loadDir(HOME)}>/</span>
      {#each breadcrumbs as crumb, i}
        <span class="files-crumb-sep">›</span>
        <span
          class="files-crumb-chip"
          on:click={() => loadDir('/' + breadcrumbs.slice(0, i + 1).join('/'))}
        >
          {crumb === 'home' && breadcrumbs[i + 1] === 'sanu' ? '~' : crumb}
        </span>
      {/each}
    </div>

    <!-- Filter input -->
    <input
      type="text"
      placeholder="Filter..."
      bind:value={filterText}
      class="files-filter-input"
    />

    <!-- Action Buttons -->
    <button class="icon-btn" on:click={() => (isGrid = !isGrid)} title="Toggle Grid/List">
      {@html getIconSvg(isGrid ? 'view-grid' : 'view-list')}
    </button>
    <button
      class="icon-btn"
      on:click={() => {
        const name = prompt('New Folder Name:', 'New Folder');
        if (name) api.mkdir(currentPath, name).then(() => loadDir(currentPath, false)).catch(err => showToast('Error', err.message));
      }}
      title="New Folder"
    >
      {@html getIconSvg('folder')}
    </button>
    <button
      class="icon-btn"
      on:click={() => {
        const name = prompt('New File Name:', 'untitled.txt');
        if (name) api.writeFile(`${currentPath}/${name}`, '').then(() => loadDir(currentPath, false)).catch(err => showToast('Error', err.message));
      }}
      title="New File"
    >
      {@html getIconSvg('plus')}
    </button>

    {#if isTrash}
      <button
        class="icon-btn danger"
        on:click={() => {
          if (confirm('Empty trash permanently?')) {
            api.deleteItem('', true).then(() => { showToast('Trash', 'Emptied'); loadDir(TRASH, false); });
          }
        }}
        title="Empty Trash"
      >
        {@html getIconSvg('trash')}
      </button>
    {/if}
  </div>

  <!-- Body -->
  <div class="files-body">
    <!-- Sidebar -->
    <div class="files-sidebar">
      <div class="files-sidebar-item {currentPath === HOME ? 'active' : ''}" on:click={() => loadDir(HOME)}>
        {@html getIconSvg('home')} Home
      </div>
      <div class="files-sidebar-item {currentPath === DESKTOP ? 'active' : ''}" on:click={() => loadDir(DESKTOP)}>
        {@html getIconSvg('grid')} Desktop
      </div>
      <div class="files-sidebar-item {currentPath === `${HOME}/Documents` ? 'active' : ''}" on:click={() => loadDir(`${HOME}/Documents`)}>
        {@html getIconSvg('file')} Documents
      </div>
      <div class="files-sidebar-item {currentPath === `${HOME}/Downloads` ? 'active' : ''}" on:click={() => loadDir(`${HOME}/Downloads`)}>
        {@html getIconSvg('forward')} Downloads
      </div>
      <div class="files-sidebar-item {currentPath === `${HOME}/Pictures` ? 'active' : ''}" on:click={() => loadDir(`${HOME}/Pictures`)}>
        {@html getIconSvg('file-image')} Pictures
      </div>
      <div class="files-sidebar-item {currentPath === `${HOME}/Music` ? 'active' : ''}" on:click={() => loadDir(`${HOME}/Music`)}>
        {@html getIconSvg('file-audio')} Music
      </div>
      <div class="files-sidebar-item {currentPath === `${HOME}/Videos` ? 'active' : ''}" on:click={() => loadDir(`${HOME}/Videos`)}>
        {@html getIconSvg('file-video')} Videos
      </div>
      <div class="files-sidebar-item {isTrash ? 'active' : ''}" on:click={() => loadDir(TRASH)} style="margin-top: auto;">
        {@html getIconSvg('trash')} Trash
      </div>
    </div>

    <!-- Content View -->
    <div
      class="files-content-view {isGrid ? 'grid-mode' : 'list-mode'}"
      on:contextmenu={e => handleContextMenu(e)}
    >
      {#if filteredItems.length === 0}
        <div class="empty-folder-msg">This folder is empty</div>
      {:else if isGrid}
        {#each filteredItems as item}
          <div
            class="file-entry {selectedName === item.name ? 'selected' : ''}"
            on:click={() => (selectedName = item.name)}
            on:dblclick={() => handleOpenItem(item)}
            on:contextmenu={e => handleContextMenu(e, item)}
            draggable="true"
            on:dragstart={e => e.dataTransfer?.setData('application/saturn-path', `${currentPath}/${item.name}`)}
          >
            <div class="icon-badge badge-{getItemIcon(item)}">
              {@html getIconSvg(getItemIcon(item))}
            </div>
            <span class="name">{item.name}</span>
          </div>
        {/each}
      {:else}
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
            {#each filteredItems as item}
              <tr
                class="file-entry-row {selectedName === item.name ? 'selected' : ''}"
                on:click={() => (selectedName = item.name)}
                on:dblclick={() => handleOpenItem(item)}
                on:contextmenu={e => handleContextMenu(e, item)}
              >
                <td style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 16px; height: 16px; display: inline-flex;">
                    {@html getIconSvg(getItemIcon(item))}
                  </span>
                  {item.name}
                </td>
                <td>{item.type === 'dir' ? '—' : formatBytes(item.size)}</td>
                <td>{item.type === 'dir' ? 'Folder' : 'File'}</td>
                <td>{new Date(item.mtime).toLocaleDateString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

<style>
  .files-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  .files-toolbar {
    height: 40px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 6px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-1);
    flex: none;
  }
  .files-nav-btns {
    display: flex;
    gap: 2px;
  }
  .icon-btn {
    width: 28px;
    height: 26px;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-dim);
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text-main);
  }
  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  :global(.icon-btn svg) {
    width: 15px;
    height: 15px;
  }
  .files-breadcrumbs {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-solid);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 2px 8px;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 11.5px;
  }
  .files-crumb-chip {
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-dim);
  }
  .files-crumb-chip:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
  .files-crumb-sep {
    color: var(--text-muted);
  }
  .files-filter-input {
    width: 120px;
    height: 26px;
    padding: 2px 8px;
    font-size: 11.5px;
  }
  .files-body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .files-sidebar {
    width: 145px;
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-1);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
  }
  .files-sidebar-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim);
  }
  .files-sidebar-item:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
  .files-sidebar-item.active {
    background: var(--accent);
    color: #ffffff;
  }
  :global(.files-sidebar-item svg) {
    width: 15px;
    height: 15px;
  }
  .files-content-view {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  .files-content-view.grid-mode {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 8px;
  }
  .file-entry {
    width: 90px;
    padding: 8px 4px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    text-align: center;
  }
  .file-entry:hover {
    background: var(--surface-1);
  }
  .file-entry.selected {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
    outline: 1px solid var(--accent);
  }
  .icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: grid;
    place-items: center;
  }
  :global(.icon-badge svg) {
    width: 24px;
    height: 24px;
  }
  .badge-folder { background: linear-gradient(145deg, #4f8eff, #2563eb); color: #fff; }
  .badge-file { background: linear-gradient(145deg, #6b7280, #4b5563); color: #fff; }
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
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }
  tr.selected td {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .empty-folder-msg {
    color: var(--text-muted);
    padding: 40px;
    text-align: center;
    width: 100%;
  }
</style>
