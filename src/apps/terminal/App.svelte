<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { TerminalSessionClient, type SessionState } from './session';
  import { TerminalBuffer } from './buffer';
  import { mapKeyboardEventToAnsi } from './keys';
  import { contextMenuStore } from '../../core/contextmenu/store';
  import { getIconSvg } from '../../assets/icons/icons';

  interface Props {
    arg?: any;
    cwd?: string;
    initialPath?: string;
  }

  let { arg, cwd: propCwd, initialPath }: Props = $props();
  let startCwd = $derived(propCwd || initialPath || (typeof arg === 'string' ? arg : undefined));

  interface TerminalTab {
    id: string;
    title: string;
    session: TerminalSessionClient;
    buffer: TerminalBuffer;
    state: SessionState;
    pid: number;
    shell: string;
    lines: string[];
    cwd?: string;
  }

  let tabs = $state<TerminalTab[]>([]);
  let activeTabIdx = $state(0);
  let fontSize = $state(13);
  let screenEl: HTMLDivElement | null = $state(null);
  let hiddenInputEl: HTMLTextAreaElement | null = $state(null);
  let isUserScrolledUp = false;
  let showQuickCommands = $state(false);

  let activeTab = $derived(tabs[activeTabIdx] || null);

  function createTab(shellName?: string, customCwd?: string): TerminalTab {
    const tabId = `term_tab_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    let newTab: TerminalTab;

    const buffer = new TerminalBuffer({
      maxScrollback: 2000,
      onUpdate: () => {
        if (newTab) {
          newTab.lines = newTab.buffer.getHtmlLines();
          scrollToBottomIfNeeded();
        }
      }
    });

    const session = new TerminalSessionClient({
      sessionId: tabId,
      shell: shellName,
      cwd: customCwd || startCwd,
      onOutput: (chunk) => {
        buffer.feed(chunk);
      },
      onReady: (info) => {
        if (newTab) {
          newTab.pid = info.pid;
          newTab.shell = info.shell;
          const shellBase = info.shell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'shell';
          newTab.title = `${shellBase} #${tabs.length || 1}`;
        }
      },
      onStateChange: (state) => {
        if (newTab) newTab.state = state;
      },
      onExit: (code) => {
        buffer.feed(`\r\n[Process completed with exit code ${code}]\r\n`);
      }
    });

    newTab = {
      id: tabId,
      title: `term #${tabs.length + 1}`,
      session,
      buffer,
      state: 'connecting',
      pid: 0,
      shell: shellName || 'shell',
      lines: [],
      cwd: customCwd || startCwd
    };

    session.connect();
    return newTab;
  }

  function handleResize() {
    if (!screenEl || !activeTab) return;
    const charWidth = fontSize * 0.6;
    const lineHeight = fontSize * 1.45;
    const cols = Math.max(20, Math.floor((screenEl.clientWidth - 20) / charWidth));
    const rows = Math.max(5, Math.floor((screenEl.clientHeight - 20) / lineHeight));
    activeTab.session.resize(cols, rows);
  }

  onMount(() => {
    const firstTab = createTab(undefined, startCwd);
    tabs = [firstTab];
    activeTabIdx = 0;

    focusTerminal();

    // Set up resize observer for real-time terminal dimensions
    let resizeObserver: ResizeObserver | null = null;
    if (screenEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(screenEl);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  });

  onDestroy(() => {
    for (const tab of tabs) {
      tab.session.disconnect();
    }
  });

  function focusTerminal() {
    hiddenInputEl?.focus();
  }

  function addTab(shellName?: string) {
    const tab = createTab(shellName, activeTab?.cwd || startCwd);
    tabs = [...tabs, tab];
    activeTabIdx = tabs.length - 1;
    focusTerminal();
  }

  function closeTab(idx: number, e?: MouseEvent) {
    e?.stopPropagation();
    if (tabs.length <= 1) {
      // Clear and reconnect single tab
      const tab = tabs[0];
      tab.buffer.clear();
      tab.session.disconnect();
      tab.session.connect();
      return;
    }

    const tabToClose = tabs[idx];
    tabToClose.session.disconnect();

    const remaining = tabs.filter((_, i) => i !== idx);
    tabs = remaining;
    if (activeTabIdx >= remaining.length) {
      activeTabIdx = remaining.length - 1;
    }
    focusTerminal();
  }

  async function scrollToBottomIfNeeded() {
    if (!isUserScrolledUp && screenEl) {
      await tick();
      screenEl.scrollTop = screenEl.scrollHeight;
    }
  }

  function handleScroll() {
    if (!screenEl) return;
    const distanceToBottom = screenEl.scrollHeight - screenEl.scrollTop - screenEl.clientHeight;
    isUserScrolledUp = distanceToBottom > 40;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!activeTab) return;

    // Handle Ctrl+Shift+C (Copy)
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      const selection = window.getSelection()?.toString();
      if (selection) {
        navigator.clipboard.writeText(selection);
        e.preventDefault();
        return;
      }
    }

    // Handle Ctrl+Shift+V (Paste)
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then((clipText) => {
        if (clipText && activeTab) activeTab.session.send(clipText);
      }).catch(() => {});
      return;
    }

    const ansiSeq = mapKeyboardEventToAnsi(e);
    if (ansiSeq !== null) {
      e.preventDefault();
      activeTab.session.send(ansiSeq);
      isUserScrolledUp = false;
      scrollToBottomIfNeeded();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    if (!activeTab) return;
    const text = e.clipboardData?.getData('text');
    if (text) {
      activeTab.session.send(text);
      isUserScrolledUp = false;
      scrollToBottomIfNeeded();
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (!activeTab) return;

    const selection = window.getSelection()?.toString();

    contextMenuStore.open(e.clientX, e.clientY, [
      {
        label: 'Copy',
        icon: 'file',
        shortcut: 'Ctrl+Shift+C',
        disabled: !selection,
        action: () => {
          if (selection) navigator.clipboard.writeText(selection);
        }
      },
      {
        label: 'Paste',
        icon: 'editor',
        shortcut: 'Ctrl+Shift+V',
        action: async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText && activeTab) activeTab.session.send(clipText);
          } catch {}
        }
      },
      { separator: true },
      {
        label: 'Send Ctrl+C (Interrupt)',
        icon: 'stop',
        action: () => activeTab?.session.sendSignal('SIGINT')
      },
      {
        label: 'Clear Screen',
        icon: 'refresh',
        action: () => {
          activeTab?.buffer.clear();
          activeTab?.session.send('\x0c');
        }
      },
      { separator: true },
      {
        label: 'New Tab (Default Shell)',
        icon: 'plus',
        action: () => addTab()
      },
      {
        label: 'New PowerShell Tab',
        icon: 'terminal',
        action: () => addTab('powershell')
      },
      {
        label: 'New Command Prompt Tab',
        icon: 'terminal',
        action: () => addTab('cmd')
      },
      { separator: true },
      {
        label: 'Close Tab',
        icon: 'close',
        action: () => closeTab(activeTabIdx)
      }
    ]);
  }

  function runSnippet(cmd: string) {
    if (!activeTab) return;
    activeTab.session.send(cmd + '\r');
    showQuickCommands = false;
    focusTerminal();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="terminal-app"
  onclick={focusTerminal}
  oncontextmenu={handleContextMenu}
>
  <!-- Hidden textarea to capture keyboard focus & IME -->
  <textarea
    bind:this={hiddenInputEl}
    class="terminal-hidden-input"
    onkeydown={handleKeyDown}
    onpaste={handlePaste}
    aria-label="Terminal Input"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
  ></textarea>

  <!-- Tabs & Actions Bar -->
  <div class="terminal-tabs-bar">
    <div class="tabs-list">
      {#each tabs as tab, idx (tab.id)}
        <div
          class="terminal-tab"
          class:active={idx === activeTabIdx}
          role="tab"
          tabindex="0"
          onclick={() => { activeTabIdx = idx; focusTerminal(); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { activeTabIdx = idx; focusTerminal(); } }}
        >
          <span class="tab-status-dot {tab.state}"></span>
          <span class="tab-title">{tab.title}</span>
          <button 
            type="button"
            class="tab-close-btn" 
            onclick={(e) => closeTab(idx, e)}
            title="Close Tab"
          >×</button>
        </div>
      {/each}
    </div>

    <!-- Toolbar buttons -->
    <div class="terminal-toolbar-actions">
      <!-- Quick Snippets -->
      <div class="snippets-dropdown-wrapper">
        <button
          type="button"
          class="term-action-btn"
          onclick={() => (showQuickCommands = !showQuickCommands)}
          title="Quick Commands"
        >
          ⚡ Snippets
        </button>
        {#if showQuickCommands}
          <div class="snippets-menu">
            <button type="button" onclick={() => runSnippet('dir')}>📂 List Files (dir)</button>
            <button type="button" onclick={() => runSnippet('ls -la')}>📂 List Files (ls -la)</button>
            <button type="button" onclick={() => runSnippet('pwd')}>📍 Current Path (pwd)</button>
            <button type="button" onclick={() => runSnippet('node -v')}>🟢 Node Version</button>
            <button type="button" onclick={() => runSnippet('git status')}>🌿 Git Status</button>
            <button type="button" onclick={() => runSnippet('cls')}>🧹 Clear (cls)</button>
            <button type="button" onclick={() => runSnippet('clear')}>🧹 Clear (clear)</button>
          </div>
        {/if}
      </div>

      <!-- Clear Buffer -->
      <button
        type="button"
        class="term-action-btn"
        onclick={() => { activeTab?.buffer.clear(); activeTab?.session.send('\x0c'); focusTerminal(); }}
        title="Clear Buffer (Ctrl+L)"
      >
        Clear
      </button>

      <!-- Font Zoom -->
      <div class="font-zoom-group">
        <button
          type="button"
          class="term-action-btn"
          onclick={() => (fontSize = Math.max(10, fontSize - 1))}
          title="Zoom Out"
        >A-</button>
        <span class="font-size-label">{fontSize}px</span>
        <button
          type="button"
          class="term-action-btn"
          onclick={() => (fontSize = Math.min(22, fontSize + 1))}
          title="Zoom In"
        >A+</button>
      </div>

      <!-- Add Tab Dropdown -->
      <button 
        type="button"
        class="new-tab-btn" 
        onclick={() => addTab()} 
        title="New Terminal Tab"
      >
        {@html getIconSvg('plus', 1.6)}
      </button>
    </div>
  </div>

  <!-- Terminal Screen Viewport -->
  <div 
    bind:this={screenEl}
    class="terminal-screen"
    style={`font-size: ${fontSize}px;`}
    onscroll={handleScroll}
  >
    {#if activeTab}
      <div class="terminal-output">
        {#each activeTab.lines as lineHtml}
          <div class="terminal-row">{@html lineHtml}</div>
        {/each}
        <!-- Blinking block cursor -->
        <span class="terminal-cursor">█</span>
      </div>
    {/if}
  </div>

  <!-- Bottom Status Bar -->
  <footer class="terminal-status-bar">
    <div class="status-left">
      {#if activeTab}
        <span class="conn-pill {activeTab.state}">
          <span class="dot"></span>
          {activeTab.state.toUpperCase()}
        </span>
        <span class="status-item">Shell: {activeTab.shell}</span>
        {#if activeTab.pid > 0}
          <span class="status-item">PID: {activeTab.pid}</span>
        {/if}
        {#if activeTab.cwd}
          <span class="status-item cwd-label" title={activeTab.cwd}>📁 {activeTab.cwd}</span>
        {/if}
      {/if}
    </div>

    <div class="status-right">
      <span class="status-hint">UTF-8 • VT100 / ANSI TrueColor</span>
    </div>
  </footer>
</div>

<style>
  .terminal-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #181a1f;
    color: #abb2bf;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace;
    position: relative;
    user-select: text;
    overflow: hidden;
  }

  .terminal-hidden-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
    top: -100px;
    left: -100px;
  }

  /* Tabs Bar */
  .terminal-tabs-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e2227;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    height: 36px;
    padding: 0 8px;
    gap: 8px;
  }

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    max-width: 65%;
  }

  .terminal-tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 12px;
    color: #828997;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .terminal-tab:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #abb2bf;
  }

  .terminal-tab.active {
    background: #282c34;
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .tab-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6c7086;
  }

  .tab-status-dot.connected {
    background: #98c379;
    box-shadow: 0 0 6px #98c379;
  }

  .tab-status-dot.connecting {
    background: #e5c07b;
  }

  .tab-status-dot.error,
  .tab-status-dot.disconnected {
    background: #e06c75;
  }

  .tab-title {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close-btn {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    border-radius: 2px;
    opacity: 0.6;
  }

  .tab-close-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.15);
  }

  .terminal-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .term-action-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #abb2bf;
    font-size: 11px;
    padding: 3px 8px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .term-action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .font-zoom-group {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 1px;
  }

  .font-zoom-group .term-action-btn {
    border: none;
    background: transparent;
    padding: 2px 6px;
  }

  .font-size-label {
    font-size: 10px;
    color: #6c7086;
    padding: 0 4px;
  }

  .snippets-dropdown-wrapper {
    position: relative;
  }

  .snippets-menu {
    position: absolute;
    top: 30px;
    right: 0;
    background: #21252b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    min-width: 170px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .snippets-menu button {
    background: transparent;
    border: none;
    color: #abb2bf;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    font-family: inherit;
    transition: background 0.1s;
  }

  .snippets-menu button:hover {
    background: #3a3f4b;
    color: #fff;
  }

  .new-tab-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #abb2bf;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .new-tab-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  /* Screen Viewport */
  .terminal-screen {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px 14px;
    line-height: 1.45;
    background: #181a1f;
    cursor: text;
  }

  .terminal-screen::-webkit-scrollbar {
    width: 8px;
  }

  .terminal-screen::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 4px;
  }

  .terminal-screen::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .terminal-output {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .terminal-row {
    min-height: 1.45em;
  }

  .terminal-cursor {
    display: inline-block;
    color: #528bff;
    animation: cursor-blink 1s steps(2, start) infinite;
    line-height: 1;
    vertical-align: baseline;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Status Bar */
  .terminal-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #1e2227;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    color: #636d83;
    user-select: none;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .conn-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
  }

  .conn-pill.connected {
    color: #98c379;
    background: rgba(152, 195, 121, 0.1);
  }

  .conn-pill.connecting {
    color: #e5c07b;
    background: rgba(229, 192, 123, 0.1);
  }

  .conn-pill.error,
  .conn-pill.disconnected {
    color: #e06c75;
    background: rgba(224, 108, 117, 0.1);
  }

  .conn-pill .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-item {
    font-size: 11px;
  }

  .cwd-label {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-hint {
    font-size: 10px;
    opacity: 0.7;
  }
</style>
