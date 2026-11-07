<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type FsInfo } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';
  import { getIconSvg } from '../../assets/icons/icons';

  interface Props {
    arg?: any;
    initialFile?: string;
    filePath?: string;
  }

  let { arg, initialFile, filePath: propFilePath }: Props = $props();
  let startFile = $derived(propFilePath || initialFile || (typeof arg === 'string' ? arg : undefined));

  interface Tab {
    path: string | null;
    name: string;
    content: string;
    dirty: boolean;
  }

  let fsInfo = $state<FsInfo | null>(null);
  let tabs = $state<Tab[]>([]);
  let activeIdx = $state(0);
  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let lineNumbersEl: HTMLDivElement | null = $state(null);

  // Save As Modal
  let saveAsModal = $state<{ open: boolean; filename: string }>({
    open: false,
    filename: ''
  });

  let activeTab = $derived(tabs[activeIdx] || null);
  let lineCount = $derived(activeTab ? (activeTab.content || '').split('\n').length : 1);

  async function openFile(filePath: string) {
    if (!filePath) return;
    const existing = tabs.findIndex(t => t.path === filePath);
    if (existing >= 0) {
      activeIdx = existing;
      return;
    }
    try {
      const res = await api.readFile(filePath);
      const name = filePath.split(/[\\/]/).pop() || 'File';
      tabs = [...tabs, { path: filePath, name, content: res.content || '', dirty: false }];
      activeIdx = tabs.length - 1;
    } catch (err: any) {
      showToast('Editor Error', err.message);
    }
  }

  async function saveFile() {
    if (!activeTab) return;
    if (!activeTab.path) {
      // Prompt Save As
      saveAsModal = {
        open: true,
        filename: activeTab.name || 'Untitled.txt'
      };
      return;
    }

    try {
      await api.writeFile(activeTab.path, activeTab.content);
      activeTab.dirty = false;
      showToast('Saved', activeTab.name);
    } catch (err: any) {
      showToast('Save Failed', err.message);
    }
  }

  async function submitSaveAs() {
    if (!activeTab || !saveAsModal.filename.trim()) return;
    const name = saveAsModal.filename.trim();
    const saveDir = fsInfo?.desktop || fsInfo?.documents || fsInfo?.home || '~';
    const isWin = fsInfo?.platform === 'win32';
    const sep = isWin ? '\\' : '/';
    const targetPath = `${saveDir}${sep}${name}`;

    try {
      await api.writeFile(targetPath, activeTab.content);
      activeTab.path = targetPath;
      activeTab.name = name;
      activeTab.dirty = false;
      saveAsModal.open = false;
      showToast('Saved As', name);
    } catch (err: any) {
      showToast('Save Failed', err.message);
    }
  }

  function closeTab(idx: number, e?: MouseEvent) {
    e?.stopPropagation();
    const tab = tabs[idx];
    if (tab && tab.dirty && !confirm(`Discard unsaved changes to "${tab.name}"?`)) {
      return;
    }

    tabs = tabs.filter((_, i) => i !== idx);
    if (tabs.length === 0) {
      tabs = [{ path: null, name: 'Untitled.txt', content: '', dirty: false }];
      activeIdx = 0;
    } else {
      activeIdx = Math.max(0, Math.min(activeIdx, tabs.length - 1));
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (saveAsModal.open) return;

    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveFile();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!textareaEl || !activeTab) return;
      const start = textareaEl.selectionStart;
      textareaEl.setRangeText('  ', start, textareaEl.selectionEnd, 'end');
      activeTab.content = textareaEl.value;
      activeTab.dirty = true;
    }
  }

  function syncScroll() {
    if (lineNumbersEl && textareaEl) {
      lineNumbersEl.scrollTop = textareaEl.scrollTop;
    }
  }

  onMount(async () => {
    const info = await api.fsInfo();
    if (info) fsInfo = info;

    if (startFile) {
      await openFile(startFile);
    } else {
      tabs = [{ path: null, name: 'Untitled.txt', content: '', dirty: false }];
    }
  });

  $effect(() => {
    if (startFile && !tabs.some(t => t.path === startFile)) {
      openFile(startFile);
    }
  });
</script>

<div class="editor-app">
  <!-- Tabs Bar -->
  <header class="editor-tabs-bar">
    <div class="tabs-scroll-area">
      {#each tabs as tab, idx (tab.path || idx)}
        <div
          class="editor-tab"
          class:active={idx === activeIdx}
          role="tab"
          tabindex="0"
          onclick={() => (activeIdx = idx)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') activeIdx = idx; }}
        >
          <span>{tab.name}{tab.dirty ? ' •' : ''}</span>
          <button
            type="button"
            class="close-btn"
            onclick={(e) => closeTab(idx, e)}
            title="Close Tab"
          >×</button>
        </div>
      {/each}
    </div>

    <button
      type="button"
      class="icon-btn-plus"
      onclick={() => {
        tabs = [...tabs, { path: null, name: `Untitled ${tabs.length + 1}.txt`, content: '', dirty: false }];
        activeIdx = tabs.length - 1;
      }}
      title="New Tab"
    >
      +
    </button>
  </header>

  <!-- Editor Main Area -->
  <main class="editor-main-area">
    <div class="editor-line-numbers" bind:this={lineNumbersEl}>
      {#each Array(lineCount) as _, i}
        <div>{i + 1}</div>
      {/each}
    </div>

    {#if activeTab}
      <textarea
        bind:this={textareaEl}
        bind:value={activeTab.content}
        oninput={() => {
          if (activeTab && !activeTab.dirty) {
            activeTab.dirty = true;
          }
        }}
        onscroll={syncScroll}
        onkeydown={handleKeydown}
        class="editor-textarea"
        spellcheck="false"
        placeholder="Type here..."
      ></textarea>
    {:else}
      <div class="empty-editor-msg">No file open</div>
    {/if}
  </main>

  <!-- Status Bar -->
  <footer class="editor-status-bar">
    <button
      type="button"
      class="btn-save"
      onclick={saveFile}
    >
      {@html getIconSvg('editor')} Save (Ctrl+S)
    </button>

    <button
      type="button"
      class="btn-save-as"
      onclick={() => {
        if (activeTab) {
          saveAsModal = { open: true, filename: activeTab.name || 'document.txt' };
        }
      }}
    >
      Save As...
    </button>

    <span class="status-sep">|</span>
    <span>{lineCount} lines</span>

    <span class="file-path-info" title={activeTab?.path || ''}>
      {activeTab?.path || activeTab?.name || 'Untitled'}
    </span>
  </footer>

  <!-- Save As Modal -->
  {#if saveAsModal.open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => (saveAsModal.open = false)}>
      <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Save File</h3>
          <button type="button" class="close-x" onclick={() => (saveAsModal.open = false)}>×</button>
        </div>
        <form onsubmit={(e) => { e.preventDefault(); submitSaveAs(); }}>
          <div class="modal-body">
            <label for="saveas-filename">File Name:</label>
            <input
              id="saveas-filename"
              type="text"
              class="modal-input"
              bind:value={saveAsModal.filename}
              autofocus
            />
            <small class="save-loc-hint">Will be saved to: {fsInfo?.desktop || 'Desktop'}</small>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" onclick={() => (saveAsModal.open = false)}>Cancel</button>
            <button type="submit" class="btn-primary">Save File</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .editor-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--bg-window, #1e1e24);
    color: var(--text-primary, #e2e8f0);
    overflow: hidden;
  }

  .editor-tabs-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px 0;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--surface-1, rgba(255, 255, 255, 0.02));
    overflow-x: auto;
    flex: none;
    height: 36px;
  }

  .tabs-scroll-area {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
  }

  .editor-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim, #94a3b8);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    user-select: none;
    transition: all 0.1s ease;
    white-space: nowrap;
  }

  .editor-tab:hover {
    background: var(--surface-2, rgba(255, 255, 255, 0.06));
    color: #ffffff;
  }

  .editor-tab.active {
    background: var(--surface-solid, rgba(0, 0, 0, 0.3));
    color: #ffffff;
    border-color: var(--border-subtle, rgba(255, 255, 255, 0.1));
    font-weight: 500;
  }

  .close-btn {
    opacity: 0.6;
    font-size: 13px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0 2px;
    border-radius: 2px;
  }

  .close-btn:hover {
    opacity: 1;
    color: #ef4444;
  }

  .icon-btn-plus {
    padding: 2px 8px;
    font-size: 16px;
    background: transparent;
    border: none;
    color: var(--text-dim, #94a3b8);
    cursor: pointer;
    border-radius: 4px;
  }

  .icon-btn-plus:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .editor-main-area {
    flex: 1;
    display: flex;
    min-height: 0;
    background: var(--surface-solid, rgba(0, 0, 0, 0.25));
  }

  .editor-line-numbers {
    width: 48px;
    padding: 8px 6px;
    text-align: right;
    font-family: var(--font-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted, #64748b);
    border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    user-select: none;
    overflow: hidden;
    background: var(--surface-1, rgba(255, 255, 255, 0.02));
  }

  .editor-textarea {
    flex: 1;
    border: none;
    background: transparent;
    resize: none;
    font-family: var(--font-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-primary, #e2e8f0);
    padding: 8px 12px;
    outline: none;
    white-space: pre;
    overflow: auto;
  }

  .empty-editor-msg {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--text-muted, #64748b);
  }

  .editor-status-bar {
    height: 30px;
    background: var(--surface-1, rgba(255, 255, 255, 0.03));
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-muted, #94a3b8);
    gap: 10px;
    flex: none;
  }

  .btn-save, .btn-save-as {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--accent, #2563eb);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-save:hover {
    background: #1d4ed8;
  }

  .btn-save-as {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary, #e2e8f0);
  }

  .btn-save-as:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  :global(.btn-save svg) {
    width: 12px;
    height: 12px;
  }

  .status-sep {
    color: rgba(255, 255, 255, 0.15);
  }

  .file-path-info {
    margin-left: auto;
    color: var(--text-dim, #94a3b8);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Modal */
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
    gap: 8px;
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

  .save-loc-hint {
    color: #94a3b8;
    font-size: 11px;
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
    cursor: pointer;
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
</style>
