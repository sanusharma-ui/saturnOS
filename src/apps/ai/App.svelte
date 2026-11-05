<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../../core/api/client';
  import { updateThemeSettings } from '../../core/theme/store';
  import { appRegistry } from '../../core/registry/appRegistry';
  import { openApp } from '../../core/wm/manager';
  import { searchOpenStore, searchQueryStore } from '../../core/search/searchEngine';

  export let arg: string | undefined = undefined;

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    isError?: boolean;
    sysInfoCard?: any;
  }

  const SYSTEM_PROMPT = `You are Saturn AI, the desktop assistant of Saturn OS. Reply in markdown concisely.
When explicitly asked to open an app, search, change a setting, or see system info, you MUST reply ONLY with a single JSON object:
- {"open":"terminal|files|browser|editor|monitor|settings|calculator|calendar|clock|media|images|ai"}
- {"search":"query"}
- {"setting":"theme","value":"dark|light"}
- {"setting":"accent","value":"blue|purple|green|orange|red|teal"}
- {"setting":"effects","value":"on|off"}
- {"sysinfo":true}
Otherwise, converse normally and helpfully.`;

  let messages: Message[] = [];
  try {
    const saved = localStorage.getItem('saturn.ai_history');
    if (saved) messages = JSON.parse(saved);
  } catch (e) {
    messages = [];
  }

  let inputText = '';
  let brainStatus: 'loading' | 'online' | 'offline' = 'loading';
  let isGenerating = false;
  let abortController: AbortController | null = null;
  let chatAreaEl: HTMLDivElement;
  let healthInterval: any = null;

  async function checkHealth() {
    try {
      const res = await api.llmHealth();
      if (res.ok && res.data?.status === 'ok') {
        brainStatus = 'online';
      } else if (res.data?.status === 'loading' || (res.status === 503 && res.data?.status !== 'offline')) {
        brainStatus = 'loading';
      } else {
        brainStatus = 'offline';
      }
    } catch (e) {
      brainStatus = 'offline';
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('saturn.ai_history', JSON.stringify(messages.slice(-30)));
    } catch (e) {}
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatAreaEl) chatAreaEl.scrollTop = chatAreaEl.scrollHeight;
    }, 20);
  }

  async function sendMessage(textToSend: string) {
    const text = textToSend.trim();
    if (!text || isGenerating) return;

    messages = [...messages, { role: 'user', content: text }];
    saveHistory();
    inputText = '';
    scrollToBottom();

    isGenerating = true;
    abortController = new AbortController();

    const currentMsgIndex = messages.length;
    messages = [...messages, { role: 'assistant', content: '…' }];

    let accumulated = '';

    try {
      const historyPayload = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(0, -1).slice(-16).map(m => ({ role: m.role, content: m.content }))
      ];

      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyPayload, stream: true }),
        signal: abortController.signal
      });

      if (!res.ok) {
        let errJson = {};
        try { errJson = await res.json(); } catch (e) {}
        throw new Error((errJson as any).error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              accumulated += delta;
              messages[currentMsgIndex].content = accumulated;
              messages = [...messages];
              scrollToBottom();
            } catch (e) {}
          }
        }
      }

      // Check tool call
      const isTool = await handleToolCall(accumulated, currentMsgIndex);
      if (!isTool) {
        messages[currentMsgIndex].content = accumulated;
      }
      saveHistory();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        accumulated += ' (Stopped)';
        messages[currentMsgIndex].content = accumulated;
        saveHistory();
      } else {
        messages[currentMsgIndex] = {
          role: 'assistant',
          content: `Request Error: ${err.message}`,
          isError: true
        };
      }
    } finally {
      isGenerating = false;
      abortController = null;
      scrollToBottom();
    }
  }

  async function handleToolCall(rawText: string, msgIndex: number): Promise<boolean> {
    const trimmed = rawText.trim();
    let jsonStr = trimmed;

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) return false;

    let toolData: any = null;
    try {
      toolData = JSON.parse(jsonStr);
    } catch (e) {
      return false;
    }

    if (!toolData || typeof toolData !== 'object') return false;

    // 1. Open App
    if (toolData.open) {
      const target = toolData.open.toLowerCase();
      const manifest = appRegistry.get(target);
      if (manifest) {
        openApp(manifest);
        messages[msgIndex].content = `Opened **${manifest.name}**.`;
      } else {
        messages[msgIndex].content = `App **${toolData.open}** not found.`;
      }
      return true;
    }

    // 2. Search
    if (typeof toolData.search === 'string') {
      searchQueryStore.set(toolData.search);
      searchOpenStore.set(true);
      messages[msgIndex].content = `Searching for *"${toolData.search}"*...`;
      return true;
    }

    // 3. Setting
    if (toolData.setting) {
      const key = toolData.setting;
      const val = toolData.value;
      if (key === 'theme' && (val === 'dark' || val === 'light')) {
        updateThemeSettings({ theme: val });
        messages[msgIndex].content = `Changed desktop theme to **${val}**.`;
        return true;
      }
      if (key === 'accent') {
        updateThemeSettings({ accent: val });
        messages[msgIndex].content = `Changed accent color to **${val}**.`;
        return true;
      }
      if (key === 'effects') {
        updateThemeSettings({ effects: val === 'on' });
        messages[msgIndex].content = `Visual effects set to **${val}**.`;
        return true;
      }
    }

    // 4. System Info (ONLY case where sysinfo appears in chat!)
    if (toolData.sysinfo === true) {
      try {
        const info = await api.getSysinfo();
        messages[msgIndex].content = '';
        messages[msgIndex].sysInfoCard = info;
        return true;
      } catch (e: any) {
        messages[msgIndex].content = `Could not fetch system info: ${e.message}`;
        return true;
      }
    }

    return false;
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatMarkdown(text: string): string {
    let s = text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
    s = s.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    s = s.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
    return s;
  }

  onMount(() => {
    checkHealth();
    healthInterval = setInterval(checkHealth, 3000);
    if (arg && typeof arg === 'string') {
      setTimeout(() => sendMessage(arg as string), 200);
    }
  });

  onDestroy(() => {
    if (healthInterval) clearInterval(healthInterval);
    if (abortController) abortController.abort();
  });
</script>

<div class="ai-app">
  <!-- Header Status Bar -->
  <div class="ai-status-bar">
    <div class="status-indicator {brainStatus}"></div>
    {#if brainStatus === 'online'}
      <span style="color: #22c55e;">Brain online</span>
    {:else if brainStatus === 'loading'}
      <span style="color: var(--text-dim); display: inline-flex; align-items: center; gap: 6px;">
        <span class="ai-spinner"></span> Brain is loading...
      </span>
    {:else}
      <span style="color: #ef4444; display: inline-flex; align-items: center; gap: 6px;">
        Brain offline <button class="link-btn" on:click={checkHealth}>Retry</button>
      </span>
    {/if}

    <button
      class="icon-btn-clear"
      on:click={() => {
        messages = [];
        try { localStorage.removeItem('saturn.ai_history'); } catch (e) {}
      }}
      title="Clear Chat History"
    >
      Clear
    </button>
  </div>

  <!-- Messages -->
  <div class="ai-chat-area" bind:this={chatAreaEl}>
    {#each messages as msg}
      <div class="msg-bubble {msg.role} {msg.isError ? 'error-bubble' : ''}">
        {#if msg.sysInfoCard}
          <div class="sysinfo-card">
            <div style="font-weight: 600; color: var(--accent); margin-bottom: 4px;">Saturn OS System Info</div>
            <div class="sysinfo-grid">
              <div><b>CPU:</b> {msg.sysInfoCard.cpu}% ({msg.sysInfoCard.cores} cores)</div>
              <div><b>Memory:</b> {formatBytes(msg.sysInfoCard.mem.total - msg.sysInfoCard.mem.avail)} / {formatBytes(msg.sysInfoCard.mem.total)}</div>
              <div><b>Disk:</b> {formatBytes(msg.sysInfoCard.disk.total - msg.sysInfoCard.disk.free)} / {formatBytes(msg.sysInfoCard.disk.total)}</div>
              <div><b>Uptime:</b> {Math.floor(msg.sysInfoCard.uptime / 3600)}h {Math.floor((msg.sysInfoCard.uptime % 3600) / 60)}m</div>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
              Kernel {msg.sysInfoCard.kernel} · Host {msg.sysInfoCard.hostname}
            </div>
          </div>
        {:else if msg.isError}
          <div>{msg.content}</div>
          <button class="btn-primary" style="margin-top: 6px; font-size: 11px;" on:click={() => sendMessage(messages[messages.length - 2]?.content || '')}>
            Retry
          </button>
        {:else}
          {@html formatMarkdown(msg.content)}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Input Bar -->
  <div class="ai-input-bar">
    <textarea
      placeholder={brainStatus === 'online' ? 'Ask Saturn AI or tell it to open an app...' : brainStatus === 'loading' ? 'Brain is loading...' : 'Brain offline'}
      disabled={brainStatus !== 'online'}
      bind:value={inputText}
      on:keydown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(inputText);
        }
      }}
      rows="1"
    ></textarea>

    {#if isGenerating}
      <button class="icon-btn-stop" on:click={() => abortController?.abort()} title="Stop Generation">
        Stop
      </button>
    {:else}
      <button
        class="btn-primary"
        disabled={brainStatus !== 'online' || !inputText.trim()}
        on:click={() => sendMessage(inputText)}
      >
        Send
      </button>
    {/if}
  </div>
</div>

<style>
  .ai-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  .ai-status-bar {
    height: 36px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    font-size: 12px;
    flex: none;
  }
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: #888888;
  }
  .status-indicator.online {
    background: #22c55e;
    box-shadow: 0 0 8px #22c55e;
  }
  .status-indicator.loading {
    background: #f59e0b;
  }
  .status-indicator.offline {
    background: #ef4444;
  }
  .ai-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--text-muted);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .link-btn {
    background: transparent;
    border: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: 11.5px;
  }
  .icon-btn-clear {
    margin-left: auto;
    padding: 2px 8px;
    font-size: 11px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-dim);
  }
  .icon-btn-clear:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
  .ai-chat-area {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    user-select: text;
  }
  .msg-bubble {
    max-width: 86%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }
  .msg-bubble.user {
    align-self: flex-end;
    background: var(--accent);
    color: #ffffff;
    border-bottom-right-radius: 2px;
  }
  .msg-bubble.assistant {
    align-self: flex-start;
    background: var(--surface-solid);
    border: 1px solid var(--border-subtle);
    border-bottom-left-radius: 2px;
  }
  .msg-bubble.error-bubble {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }
  :global(.msg-bubble pre) {
    background: rgba(0, 0, 0, 0.55);
    padding: 8px 10px;
    border-radius: 6px;
    font-family: var(--font-mono, monospace);
    font-size: 11.5px;
    overflow-x: auto;
    margin: 6px 0;
  }
  :global(.msg-bubble code) {
    font-family: var(--font-mono, monospace);
    background: rgba(255, 255, 255, 0.12);
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 11.5px;
  }
  .sysinfo-card {
    background: var(--surface-1);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .sysinfo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    font-size: 12px;
  }
  .ai-input-bar {
    padding: 8px 12px;
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-1);
    display: flex;
    gap: 8px;
    flex: none;
  }
  .ai-input-bar textarea {
    flex: 1;
    resize: none;
    height: 38px;
    padding: 8px 10px;
    line-height: 1.4;
    border-radius: 6px;
    font-size: 13px;
  }
  .icon-btn-stop {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 0 14px;
    border-radius: 6px;
    font-weight: 500;
  }
</style>
