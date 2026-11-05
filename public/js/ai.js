'use strict';

/**
 * Saturn OS - Saturn AI Integration
 * Real streaming proxy, Brain status polling, Tool contract execution, Markdown-lite.
 */
window.SaturnAI = (function () {
  const { api, toast, escapeHtml, formatBytes } = window.SaturnShell;

  const SYSTEM_PROMPT = `You are Saturn AI, the desktop assistant of Saturn OS. Reply in markdown concisely.
When explicitly asked to open an app, search, change a setting, or see system info, you MUST reply ONLY with a single JSON object:
- {"open":"terminal|files|browser|editor|monitor|settings|calculator|calendar|clock|media|images|ai"}
- {"search":"query"}
- {"setting":"theme","value":"dark|light"}
- {"setting":"accent","value":"blue|purple|green|orange|red|teal"}
- {"setting":"effects","value":"on|off"}
- {"sysinfo":true}
Otherwise, converse normally and helpfully.`;

  let history = [];
  try {
    const saved = localStorage.getItem('saturn.ai_history');
    if (saved) history = JSON.parse(saved);
  } catch (e) {
    history = [];
  }

  let activeWin = null;
  let abortCtrl = null;
  let brainStatus = 'loading'; // 'loading' | 'online' | 'offline'
  let healthInterval = null;

  function open(initialMessage = null) {
    if (activeWin && !activeWin.minimized) {
      window.SaturnWM.focusWindow(activeWin);
      if (initialMessage) {
        handleUserSend(initialMessage);
      }
      return activeWin;
    }

    activeWin = window.SaturnWM.createWindow({
      appId: 'ai',
      title: 'Saturn AI',
      icon: 'ai',
      width: 580,
      height: 540,
      singleInstance: true,
      contentRenderer: setupAiWindow
    });

    if (initialMessage) {
      setTimeout(() => handleUserSend(initialMessage), 300);
    }
    return activeWin;
  }

  function setupAiWindow(win) {
    win.bodyEl.innerHTML = `
      <div class="ai-app">
        <div class="ai-header-status">
          <div class="ai-status-indicator loading" id="ai-dot"></div>
          <span id="ai-status-text" style="color: var(--text-dim);">Checking Brain...</span>
          <button id="ai-clear-btn" style="margin-left: auto; padding: 2px 8px; font-size: 11px;">Clear Chat</button>
        </div>
        <div class="ai-chat-area" id="ai-messages"></div>
        <div class="ai-input-bar">
          <textarea id="ai-input" placeholder="Brain is loading..." disabled rows="1"></textarea>
          <button class="btn-primary" id="ai-send-btn" disabled>Send</button>
          <button id="ai-stop-btn" style="display: none; color: #ef4444; border-color: #ef4444;">Stop</button>
        </div>
      </div>
    `;

    const chatArea = win.bodyEl.querySelector('#ai-messages');
    const input = win.bodyEl.querySelector('#ai-input');
    const sendBtn = win.bodyEl.querySelector('#ai-send-btn');
    const stopBtn = win.bodyEl.querySelector('#ai-stop-btn');
    const clearBtn = win.bodyEl.querySelector('#ai-clear-btn');

    // Render historical messages
    renderHistory();

    // Health polling every 3 seconds (Part 3 Bug 5)
    pollHealth();
    healthInterval = setInterval(pollHealth, 3000);

    win.onClose = () => {
      clearInterval(healthInterval);
      if (abortCtrl) abortCtrl.abort();
      activeWin = null;
    };

    win.onArg = arg => {
      if (typeof arg === 'string' && arg.trim()) {
        handleUserSend(arg.trim());
      }
    };

    // Events
    sendBtn.onclick = () => {
      const text = input.value.trim();
      if (text) {
        input.value = '';
        handleUserSend(text);
      }
    };

    stopBtn.onclick = () => {
      if (abortCtrl) {
        abortCtrl.abort();
        abortCtrl = null;
        stopBtn.style.display = 'none';
        sendBtn.style.display = '';
      }
    };

    clearBtn.onclick = () => {
      history = [];
      try { localStorage.removeItem('saturn.ai_history'); } catch (e) {}
      chatArea.innerHTML = '';
    };

    input.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    };
  }

  async function pollHealth() {
    if (!activeWin) return;
    const dot = activeWin.bodyEl.querySelector('#ai-dot');
    const statusText = activeWin.bodyEl.querySelector('#ai-status-text');
    const input = activeWin.bodyEl.querySelector('#ai-input');
    const sendBtn = activeWin.bodyEl.querySelector('#ai-send-btn');
    if (!dot || !statusText || !input || !sendBtn) return;

    try {
      const res = await fetch('/api/llm/health');
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        brainStatus = 'online';
        dot.className = 'ai-status-indicator online';
        statusText.innerHTML = '<span style="color: #22c55e;">Brain online</span>';
        if (input.disabled && !abortCtrl) {
          input.disabled = false;
          sendBtn.disabled = false;
          input.placeholder = 'Ask Saturn AI or command your desktop...';
        }
      } else if (data.status === 'loading' || (res.status === 503 && data.status !== 'offline')) {
        brainStatus = 'loading';
        dot.className = 'ai-status-indicator loading';
        statusText.innerHTML = '<span class="ai-spinner" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span> Brain is loading...';
        if (!abortCtrl) {
          input.disabled = true;
          sendBtn.disabled = true;
          input.placeholder = 'Brain is loading...';
        }
      } else {
        throw new Error(data.error || 'Offline');
      }
    } catch (e) {
      brainStatus = 'offline';
      dot.className = 'ai-status-indicator offline';
      statusText.innerHTML = `<span style="color: #ef4444;">Brain offline</span> <a href="#" id="ai-health-retry" style="color: var(--accent); margin-left: 6px; text-decoration: underline;">Retry</a>`;
      const retryLink = activeWin.bodyEl.querySelector('#ai-health-retry');
      if (retryLink) retryLink.onclick = (ev) => { ev.preventDefault(); pollHealth(); };
      if (!abortCtrl) {
        input.disabled = true;
        sendBtn.disabled = true;
        input.placeholder = 'Brain is offline';
      }
    }
  }

  function renderHistory() {
    if (!activeWin) return;
    const chatArea = activeWin.bodyEl.querySelector('#ai-messages');
    if (!chatArea) return;

    chatArea.innerHTML = '';
    history.forEach(msg => {
      appendMessageBubble(msg.role, msg.content, false);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function appendMessageBubble(role, content, autoScroll = true) {
    if (!activeWin) return null;
    const chatArea = activeWin.bodyEl.querySelector('#ai-messages');
    if (!chatArea) return null;

    const bubble = document.createElement('div');
    bubble.className = `ai-message ${role}`;
    bubble.innerHTML = role === 'assistant' ? formatMarkdownLite(content) : escapeHtml(content);
    chatArea.appendChild(bubble);

    if (autoScroll) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
    return bubble;
  }

  async function handleUserSend(text) {
    if (!activeWin || !text) return;
    const chatArea = activeWin.bodyEl.querySelector('#ai-messages');
    const sendBtn = activeWin.bodyEl.querySelector('#ai-send-btn');
    const stopBtn = activeWin.bodyEl.querySelector('#ai-stop-btn');

    // Add user message to history
    history.push({ role: 'user', content: text });
    appendMessageBubble('user', text);
    saveHistory();

    // Create assistant bubble with placeholder
    const assistantBubble = appendMessageBubble('assistant', '…');

    // UI state while generating
    sendBtn.style.display = 'none';
    stopBtn.style.display = '';

    abortCtrl = new AbortController();
    let accumulatedText = '';

    try {
      const messagesPayload = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-16)
      ];

      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesPayload, stream: true }),
        signal: abortCtrl.signal
      });

      if (!res.ok) {
        let errJson = {};
        try { errJson = await res.json(); } catch (e) {}
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      // Stream SSE chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            accumulatedText += delta;

            // Live streaming render
            if (accumulatedText.trim().startsWith('{')) {
              assistantBubble.innerHTML = '<span style="color: var(--text-dim); font-style: italic;">Executing action...</span>';
            } else {
              assistantBubble.innerHTML = formatMarkdownLite(accumulatedText);
            }
            chatArea.scrollTop = chatArea.scrollHeight;
          } catch (e) {}
        }
      }

      // Finished streaming, process tool call or final text
      history.push({ role: 'assistant', content: accumulatedText });
      saveHistory();

      // Check tool call contract
      const isTool = await checkAndExecuteTool(accumulatedText, assistantBubble);
      if (!isTool) {
        assistantBubble.innerHTML = formatMarkdownLite(accumulatedText);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        accumulatedText += ' (Stopped)';
        history.push({ role: 'assistant', content: accumulatedText });
        saveHistory();
        assistantBubble.innerHTML = formatMarkdownLite(accumulatedText);
      } else {
        // Show actual error with Retry button (Part 3 Bug 4)
        assistantBubble.className = 'ai-message assistant error-message';
        assistantBubble.innerHTML = `
          <div><b>Request Error:</b> ${escapeHtml(err.message)}</div>
          <button class="btn-primary" style="margin-top: 8px; font-size: 11px;" id="ai-btn-retry">Retry</button>
        `;
        const retryBtn = assistantBubble.querySelector('#ai-btn-retry');
        if (retryBtn) {
          retryBtn.onclick = () => {
            assistantBubble.remove();
            handleUserSend(text);
          };
        }
      }
    } finally {
      abortCtrl = null;
      sendBtn.style.display = '';
      stopBtn.style.display = 'none';
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }

  // Tool Contract Execution
  async function checkAndExecuteTool(rawText, bubbleEl) {
    const trimmed = rawText.trim();
    let jsonStr = trimmed;

    // Check if JSON wrapped in markdown code fence
    const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeFenceMatch) {
      jsonStr = codeFenceMatch[1].trim();
    }

    if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
      return false;
    }

    let toolData = null;
    try {
      toolData = JSON.parse(jsonStr);
    } catch (e) {
      return false;
    }

    if (!toolData || typeof toolData !== 'object') return false;

    // Supported Actions:
    // 1. Open App
    if (toolData.open) {
      const appMap = {
        terminal: 'terminal',
        files: 'files',
        browser: 'browser',
        editor: 'editor',
        monitor: 'monitor',
        settings: 'settings',
        calculator: 'calc',
        calc: 'calc',
        calendar: 'calendar',
        clock: 'clock',
        media: 'viewer',
        images: 'viewer',
        ai: 'ai'
      };
      const targetApp = appMap[toolData.open] || toolData.open;
      window.SaturnShell.launchApp(targetApp);
      bubbleEl.innerHTML = `<div>Opened <b>${escapeHtml(toolData.open)}</b>.</div>`;
      return true;
    }

    // 2. Search
    if (typeof toolData.search === 'string') {
      window.SaturnShell.openSearch(toolData.search);
      bubbleEl.innerHTML = `<div>Searching for <i>"${escapeHtml(toolData.search)}"</i>...</div>`;
      return true;
    }

    // 3. Setting
    if (toolData.setting) {
      const key = toolData.setting;
      const val = toolData.value;
      const state = window.SaturnShell.getState();

      if (key === 'theme' && (val === 'dark' || val === 'light')) {
        state.theme = val;
        window.SaturnShell.applySettings();
        bubbleEl.innerHTML = `<div>Changed desktop theme to <b>${val}</b>.</div>`;
        return true;
      }
      if (key === 'accent') {
        state.accent = val;
        window.SaturnShell.applySettings();
        bubbleEl.innerHTML = `<div>Changed accent color to <b>${val}</b>.</div>`;
        return true;
      }
      if (key === 'effects') {
        state.effects = (val === 'on');
        window.SaturnShell.applySettings();
        bubbleEl.innerHTML = `<div>Visual effects set to <b>${val}</b>.</div>`;
        return true;
      }
    }

    // 4. System Info (ONLY case where sysinfo appears in chat!)
    if (toolData.sysinfo === true) {
      try {
        const info = await api('/api/sysinfo');
        const memUsed = info.mem.total - info.mem.avail;
        const diskUsed = info.disk.total - info.disk.free;

        bubbleEl.innerHTML = `
          <div class="ai-sysinfo-card">
            <div style="font-weight: 600; color: var(--accent);">Saturn OS System Info</div>
            <div style="font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <div><b>CPU:</b> ${info.cpu}% (${info.cores} cores)</div>
              <div><b>Memory:</b> ${formatBytes(memUsed)} / ${formatBytes(info.mem.total)}</div>
              <div><b>Disk:</b> ${formatBytes(diskUsed)} / ${formatBytes(info.disk.total)}</div>
              <div><b>Uptime:</b> ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m</div>
            </div>
            <div style="font-size: 11px; color: var(--text-dim);">Kernel ${escapeHtml(info.kernel)} · Host ${escapeHtml(info.hostname)}</div>
          </div>
        `;
        return true;
      } catch (err) {
        bubbleEl.innerHTML = `<div>Could not retrieve system info: ${escapeHtml(err.message)}</div>`;
        return true;
      }
    }

    return false;
  }

  // Markdown-lite Parser
  function formatMarkdownLite(str) {
    let s = escapeHtml(str);

    // Code blocks ```code```
    s = s.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold **text**
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');

    // Unordered lists
    s = s.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

    // Line breaks
    s = s.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
    return s;
  }

  function saveHistory() {
    try {
      localStorage.setItem('saturn.ai_history', JSON.stringify(history.slice(-30)));
    } catch (e) {}
  }

  return {
    open,
    pollHealth
  };
})();
