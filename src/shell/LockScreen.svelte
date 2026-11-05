<script lang="ts">
  import { onMount } from 'svelte';
  import { getIconSvg } from '../assets/icons/icons';

  interface Props {
    locked: boolean;
    onunlock: () => void;
  }

  let { locked, onunlock }: Props = $props();

  let timeStr = $state('');
  let dateStr = $state('');
  let password = $state('');
  let errorMsg = $state('');
  let inputEl: HTMLInputElement | null = $state(null);

  onMount(() => {
    const updateTime = () => {
      const d = new Date();
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });

  $effect(() => {
    if (locked) {
      password = '';
      errorMsg = '';
      setTimeout(() => inputEl?.focus(), 100);
    }
  });

  async function sha256(str: string): Promise<string> {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleUnlock() {
    const storedHash = localStorage.getItem('saturn_lock_hash');
    if (!storedHash) {
      // No password set, unlock directly
      onunlock();
      return;
    }

    const enteredHash = await sha256(password);
    if (enteredHash === storedHash) {
      onunlock();
    } else {
      errorMsg = 'Incorrect password';
      password = '';
      inputEl?.focus();
    }
  }
</script>

{#if locked}
  <div class="lockscreen-overlay">
    <div class="lock-clock-pane">
      <div class="lock-time">{timeStr}</div>
      <div class="lock-date">{dateStr}</div>
    </div>

    <div class="lock-auth-card">
      <div class="user-avatar-lg">S</div>
      <div class="user-display-name">sanu</div>

      <form class="lock-form" onsubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
        <div class="input-wrap">
          <input
            bind:this={inputEl}
            type="password"
            placeholder="Enter password..."
            bind:value={password}
            class="lock-input"
          />
          <button type="submit" class="unlock-btn">
            {@html getIconSvg('forward', 1.75)}
          </button>
        </div>

        {#if errorMsg}
          <div class="lock-error">{errorMsg}</div>
        {/if}
      </form>
    </div>
  </div>
{/if}

<style>
  .lockscreen-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999999;
    background: rgba(10, 10, 15, 0.7);
    backdrop-filter: blur(28px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
    padding: 40px 20px;
    box-sizing: border-box;
    user-select: none;
    animation: lock-fade 0.3s ease-out;
  }

  @keyframes lock-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .lock-clock-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .lock-time {
    font-size: 72px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -1px;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }

  .lock-date {
    font-size: 20px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .lock-auth-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 280px;
  }

  .user-avatar-lg {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--accent-primary);
    color: #ffffff;
    font-size: 28px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .user-display-name {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
  }

  .lock-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-wrap {
    display: flex;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-md);
    overflow: hidden;
    backdrop-filter: blur(10px);
  }

  .lock-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 14px;
    outline: none;
  }

  .lock-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .unlock-btn {
    border: none;
    background: var(--accent-primary);
    color: #ffffff;
    width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .unlock-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .lock-error {
    font-size: 12px;
    color: #ef4444;
    text-align: center;
  }
</style>
