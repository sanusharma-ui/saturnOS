<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';

  export let arg: string | undefined = undefined;

  interface Tab {
    path: string | null;
    name: string;
    content: string;
    dirty: boolean;
  }

  let tabs: Tab[] = [];
  let activeIdx = 0;
  let textareaEl: HTMLTextAreaElement;
  let lineNumbersEl: HTMLDivElement;

  $: activeTab = tabs[activeIdx] || null;
  $: lineCount = activeTab ? (activeTab.content || '').split('\n').length : 1;

  async function openFile(filePath: string) {
    const existing = tabs.findIndex(t => t.path === filePath);
    if (existing >= 0) {
      activeIdx = existing;
      return;
    }
    try {
      const res = await api.readFile(filePath);
      const name = filePath.split('/').pop() || 'File';
      tabs = [...tabs, { path: filePath, name, content: res.content || '', dirty: false }];
      activeIdx = tabs.length - 1;
    } catch (err: any) {
      showToast('Editor Error', err.message);
    }
  }

  async function saveFile() {
    if (!activeTab) return;
    let targetPath = activeTab.path;
    if (!targetPath) {
      const name = prompt('Save As (filename):', activeTab.name);
      if (!name) return;
      targetPath = `/home/sanu/Desktop/${name}`;
      activeTab.path = targetPath;
      activeTab.name = name;
    }

    try {
      await api.writeFile(targetPath, activeTab.content);
      activeTab.dirty = false;
      tabs = [...tabs];
      showToast('Saved', activeTab.name);
    } catch (err: any) {
      showToast('Save Failed', err.message);
    }
  }

  function closeTab(idx: number) {
    const tab = tabs[idx];
    if (tab.dirty && !confirm(`Discard changes to ${tab.name}?`)) return;
    tabs = tabs.filter((_, i) => i !== idx);
    activeIdx = Math.max(0, Math.min(activeIdx, tabs.length - 1));
  }

  function handleKeydown(e: KeyboardEvent) {
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
      tabs = [...tabs];
    }
  }

  function syncScroll() {
    if (lineNumbersEl && textareaEl) {
      lineNumbersEl.scrollTop = textareaEl.scrollTop;
    }
  }

  onMount(() => {
    if (arg && typeof arg === 'string') {
      openFile(arg);
    } else {
      tabs = [{ path: null, name: 'Untitled.txt', content: '', dirty: false }];
    }
  });

  $: if (arg && typeof arg === 'string') {
    openFile(arg);
  }
</script>

<div class="editor-app">
  <!-- Tabs -->
  <div class="editor-tabs-bar">
    {#each tabs as tab, idx}
      <div class="editor-tab {idx === activeIdx ? 'active' : ''}" on:click={() => (activeIdx = idx)}>
        <span>{tab.name}{tab.dirty ? ' •' : ''}</span>
        <span class="close-btn" on:click|stopPropagation={() => closeTab(idx)}>×</span>
      </div>
    {/each}
    <button
      class="icon-btn-plus"
      on:click={() => {
        tabs = [...tabs, { path: null, name: `Untitled ${tabs.length + 1}.txt`, content: '', dirty: false }];
        activeIdx = tabs.length - 1;
      }}
      title="New Tab"
    >
      +
    </button>
  </div>

  <!-- Area -->
  <div class="editor-main-area">
    <div class="editor-line-numbers" bind:this={lineNumbersEl}>
      {#each Array(lineCount) as _, i}
        <div>{i + 1}</div>
      {/each}
    </div>
    {#if activeTab}
      <textarea
        bind:this={textareaEl}
        bind:value={activeTab.content}
        on:input={() => {
          if (!activeTab.dirty) {
            activeTab.dirty = true;
            tabs = [...tabs];
          }
        }}
        on:scroll={syncScroll}
        on:keydown={handleKeydown}
        class="editor-textarea"
        spellcheck="false"
      ></textarea>
    {:else}
      <div style="flex:1; display:grid; place-items:center; color:var(--text-muted);">
        No file open
      </div>
    {/if}
  </div>

  <!-- Status Bar -->
  <div class="editor-status-bar">
    <button class="btn-primary" on:click={saveFile} style="padding: 2px 8px; font-size: 11px;">
      Save (Ctrl+S)
    </button>
    <span>{lineCount} lines</span>
    <span style="margin-left: auto; color: var(--text-dim);">{activeTab?.path || activeTab?.name || 'Empty'}</span>
  </div>
</div>

<style>
  .editor-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  .editor-tabs-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px 0;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-1);
    overflow-x: auto;
    flex: none;
  }
  .editor-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
  }
  .editor-tab.active {
    background: var(--panel-bg);
    color: var(--text-main);
    border-color: var(--border-subtle);
  }
  .close-btn {
    opacity: 0.6;
    font-size: 14px;
  }
  .close-btn:hover {
    opacity: 1;
    color: #ef4444;
  }
  .icon-btn-plus {
    padding: 2px 8px;
    font-size: 14px;
    background: transparent;
    border: none;
    color: var(--text-dim);
  }
  .icon-btn-plus:hover {
    color: var(--text-main);
  }
  .editor-main-area {
    flex: 1;
    display: flex;
    min-height: 0;
    background: var(--surface-solid);
  }
  .editor-line-numbers {
    width: 44px;
    padding: 8px 6px;
    text-align: right;
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
    border-right: 1px solid var(--border-subtle);
    user-select: none;
    overflow: hidden;
    background: var(--surface-1);
  }
  .editor-textarea {
    flex: 1;
    border: none;
    background: transparent;
    resize: none;
    font-family: var(--font-mono, monospace);
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-main);
    padding: 8px 12px;
    outline: none;
    white-space: pre;
    overflow: auto;
  }
  .editor-status-bar {
    height: 28px;
    background: var(--surface-1);
    border-top: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-muted);
    gap: 12px;
    flex: none;
  }
</style>
