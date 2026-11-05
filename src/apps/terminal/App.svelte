<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { TerminalSessionClient, type SessionState } from './session';
  import { TerminalBuffer } from './buffer';
  import { mapKeyboardEventToAnsi } from './keys';
  import { contextMenuStore } from '../../core/contextmenu/store';
  import { getIconSvg } from '../../assets/icons/icons';

  interface TerminalTab {
    id: string;
    title: string;
    session: TerminalSessionClient;
    buffer: TerminalBuffer;
    state: SessionState;
    pid: number;
    shell: string;
    lines: string[];
  }

  let tabs = $state<TerminalTab[]>([]);
  let activeTabIdx = $state(0);
  let fontSize = $state(13);
  let screenEl: HTMLDivElement | null = $state(null);
  let hiddenInputEl: HTMLTextAreaElement | null = $state(null);
  let isUserScrolledUp = false;

  let activeTab = $derived(tabs[activeTabIdx] || null);

  function createTab(): TerminalTab {
    const tabId = `term_tab_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    let newTab: TerminalTab;

    const buffer = new TerminalBuffer({
      maxScrollback: 1500,
      onUpdate: () => {
        if (newTab) {
          newTab.lines = newTab.buffer.getHtmlLines();
          scrollToBottomIfNeeded();
        }
      }
    });

    const session = new TerminalSessionClient({
      sessionId: tabId,
      onOutput: (chunk) => {
        buffer.feed(chunk);
      },
      onReady: (info) => {
        if (newTab) {
          newTab.pid = info.pid;
          newTab.shell = info.shell;
          const shellBase = info.shell.split('/').pop() || 'sh';
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
      title: `sh #${tabs.length + 1}`,
      session,
      buffer,
      state: 'connecting',
      pid: 0,
      shell: 'sh',
      lines: []
    };

    session.connect();
    return newTab;
  }

  onMount(() => {
    // Open initial tab
    const firstTab = createTab();
    tabs = [firstTab];
    activeTabIdx = 0;

    focusTerminal();
  });

  onDestroy(() => {
    // Clean up all sessions
    for (const tab of tabs) {
      tab.session.disconnect();
    }
  });

  function focusTerminal() {
    hiddenInputEl?.focus();
  }

  function addTab() {
    const tab = createTab();
    tabs = [...tabs, tab];
    activeTabIdx = tabs.length - 1;
    focusTerminal();
  }

  function closeTab(idx: number, e?: MouseEvent) {
    e?.stopPropagation();
    if (tabs.length <= 1) {
      // Just clear and reconnect single tab
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

    // Handle Ctrl+Shift+C (Copy) or Ctrl+Shift+V (Paste)
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      const selection = window.getSelection()?.toString();
      if (selection) {
        navigator.clipboard.writeText(selection);
        e.preventDefault();
        return;
      }
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
        shortcut: 'Ctrl+V',
        action: async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText && activeTab) activeTab.session.send(clipText);
          } catch {}
        }
      },
      { separator: true },
      {
        label: 'Interrupt (Ctrl+C)',
        icon: 'stop',
        action: () => activeTab?.session.sendSignal('SIGINT')
      },
      {
        label: 'Clear Buffer',
        icon: 'refresh',
        action: () => activeTab?.buffer.clear()
      },
      { separator: true },
      {
        label: 'New Tab',
        icon: 'plus',
        action: addTab
      },
      {
        label: 'Close Tab',
        icon: 'close',
        action: () => closeTab(activeTabIdx)
      }
    ]);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="terminal-app"
  onclick={focusTerminal}
  oncontextmenu={handleContextMenu}
>
  <!-- Hidden textarea to capture keyboard focus & mobile/IME inputs -->
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

  <!-- Tabs Bar -->
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

    <button class="new-tab-btn" onclick={addTab} title="New Terminal Tab">
      {@html getIconSvg('plus', 1.75)}
    </button>
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
        <span class="status-shell">
          {activeTab.shell} {#if activeTab.pid}(PID: {activeTab.pid}){/if}
        </span>
      {/if}
    </div>

    <div class="status-right">
      <button class="status-btn" onclick={() => activeTab?.buffer.clear()} title="Clear Terminal">
        Clear
      </button>
      <div class="font-scaler">
        <button 
          class="status-btn" 
          onclick={() => fontSize = Math.max(10, fontSize - 1)}
          disabled={fontSize <= 10}
          title="Decrease font size"
        >A-</button>
        <span class="font-size-text">{fontSize}px</span>
        <button 
          class="status-btn" 
          onclick={() => fontSize = Math.min(22, fontSize + 1)}
          disabled={fontSize >= 22}
          title="Increase font size"
        >A+</button>
      </div>
    </div>
  </footer>
</div>

<style>
  .terminal-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #0d1117;
    color: #e6edf3;
    font-family: "Cascadia Code", "Fira Code", "Courier New", monospace;
    overflow: hidden;
    position: relative;
    user-select: text;
  }

  .terminal-hidden-input {
    position: absolute;
    left: -9999px;
    top: -9999px;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  /* Tabs Bar */
  .terminal-tabs-bar {
    display: flex;
    align-items: center;
    background: #161b22;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    height: 32px;
    padding: 0 4px;
    user-select: none;
    flex-shrink: 0;
  }

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    flex: 1;
    height: 100%;
  }

  .terminal-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    border-radius: 4px 4px 0 0;
    color: #8b949e;
    font-family: inherit;
    font-size: 12px;
    padding: 4px 10px;
    height: 28px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    border-bottom: 2px solid transparent;
  }

  .terminal-tab:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #c9d1d9;
  }

  .terminal-tab.active {
    background: #0d1117;
    color: #58a6ff;
    border-bottom-color: #58a6ff;
  }

  .tab-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .tab-status-dot.connected { background: #3fb950; }
  .tab-status-dot.connecting { background: #d29922; }
  .tab-status-dot.disconnected, .tab-status-dot.error { background: #f85149; }

  .tab-title {
    white-space: nowrap;
  }

  .tab-close-btn {
    border: none;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;
    border-radius: 2px;
  }

  .tab-close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .new-tab-btn {
    border: none;
    background: transparent;
    color: #8b949e;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 4px;
  }

  .new-tab-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #c9d1d9;
  }

  .new-tab-btn :global(svg) {
    width: 14px;
    height: 14px;
  }

  /* Screen Viewport */
  .terminal-screen {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px 14px;
    box-sizing: border-box;
    line-height: 1.35;
    background: #0d1117;
  }

  .terminal-output {
    min-height: 100%;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .terminal-row {
    min-height: 1.35em;
  }

  .terminal-cursor {
    display: inline-block;
    color: #58a6ff;
    animation: term-blink 1s infinite steps(1);
    vertical-align: baseline;
    font-size: 0.9em;
  }

  @keyframes term-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* Status Bar */
  .terminal-status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #161b22;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    height: 26px;
    padding: 0 10px;
    font-size: 11px;
    color: #8b949e;
    user-select: none;
    flex-shrink: 0;
  }

  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .conn-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 600;
  }

  .conn-pill .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .conn-pill.connected { color: #3fb950; }
  .conn-pill.connected .dot { background: #3fb950; }
  .conn-pill.connecting { color: #d29922; }
  .conn-pill.connecting .dot { background: #d29922; }
  .conn-pill.disconnected, .conn-pill.error { color: #f85149; }
  .conn-pill.disconnected .dot, .conn-pill.error .dot { background: #f85149; }

  .status-shell {
    color: #c9d1d9;
  }

  .status-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    color: #c9d1d9;
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
  }

  .status-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .status-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .font-scaler {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .font-size-text {
    font-size: 10px;
    min-width: 24px;
    text-align: center;
  }
</style>
