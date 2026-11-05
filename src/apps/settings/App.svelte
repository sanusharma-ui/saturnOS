<script lang="ts">
  import { onMount } from 'svelte';
  import { themeSettingsStore, updateThemeSettings, type AccentColor, type ThemeMode } from '../../core/theme/store';
  import { api, type SysInfo } from '../../core/api/client';
  import { showToast } from '../../core/notifications/store';
  import { getIconSvg } from '../../assets/icons/icons';

  let currentTab = 'personalization';
  let sysinfo: SysInfo | null = null;
  let hasPassword = false;

  const accents: AccentColor[] = ['blue', 'purple', 'green', 'orange', 'red', 'teal'];

  onMount(async () => {
    try {
      sysinfo = await api.getSysinfo();
    } catch (e) {}

    try {
      hasPassword = !!localStorage.getItem('saturn.lock_pw_hash');
    } catch (e) {}
  });

  async function setPassword() {
    const pw = prompt('Enter new lock password:');
    if (pw === null) return;
    if (pw.trim() === '') {
      localStorage.removeItem('saturn.lock_pw_hash');
      localStorage.removeItem('saturn.lock_pw_salt');
      hasPassword = false;
      showToast('Security', 'Lock password removed');
      return;
    }

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(salt + pw.trim()));
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    localStorage.setItem('saturn.lock_pw_hash', hash);
    localStorage.setItem('saturn.lock_pw_salt', salt);
    hasPassword = true;
    showToast('Security', 'Lock password saved');
  }
</script>

<div class="settings-app">
  <!-- Sidebar -->
  <div class="settings-sidebar">
    <button class="tab-btn {currentTab === 'personalization' ? 'active' : ''}" on:click={() => (currentTab = 'personalization')}>
      {@html getIconSvg('effects')} Personalization
    </button>
    <button class="tab-btn {currentTab === 'display' ? 'active' : ''}" on:click={() => (currentTab = 'display')}>
      {@html getIconSvg('viewer')} Display
    </button>
    <button class="tab-btn {currentTab === 'security' ? 'active' : ''}" on:click={() => (currentTab = 'security')}>
      {@html getIconSvg('lock')} Security
    </button>
    <button class="tab-btn {currentTab === 'about' ? 'active' : ''}" on:click={() => (currentTab = 'about')}>
      {@html getIconSvg('file')} About
    </button>
  </div>

  <!-- Content -->
  <div class="settings-content">
    {#if currentTab === 'personalization'}
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="settings-row">
          <div>
            <label>Color Theme</label>
            <small>Dark and light appearance styles</small>
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              class={$themeSettingsStore.theme === 'dark' ? 'btn-primary' : ''}
              on:click={() => updateThemeSettings({ theme: 'dark' })}
            >
              Dark
            </button>
            <button
              class={$themeSettingsStore.theme === 'light' ? 'btn-primary' : ''}
              on:click={() => updateThemeSettings({ theme: 'light' })}
            >
              Light
            </button>
          </div>
        </div>

        <div class="settings-row">
          <div>
            <label>Accent Color</label>
            <small>Interface highlight tone</small>
          </div>
          <div style="display: flex; gap: 8px;">
            {#each accents as acc}
              <div
                class="accent-circle {$themeSettingsStore.accent === acc ? 'selected' : ''}"
                style="background-color: var(--accent-{acc});"
                on:click={() => updateThemeSettings({ accent: acc })}
              ></div>
            {/each}
          </div>
        </div>

        <div class="settings-row">
          <div>
            <label>Visual Effects</label>
            <small>Reduce blurs and animations for software rendering</small>
          </div>
          <button
            class={!$themeSettingsStore.effects ? 'btn-primary' : ''}
            on:click={() => updateThemeSettings({ effects: !$themeSettingsStore.effects })}
          >
            {$themeSettingsStore.effects ? 'Reduce Effects' : 'Effects Reduced'}
          </button>
        </div>

        <div class="settings-row">
          <div>
            <label>Wallpaper</label>
            <small>Default Saturn photo or custom file</small>
          </div>
          <div style="display: flex; gap: 6px;">
            <button on:click={() => { updateThemeSettings({ wallpaper: '/saturnOS.png' }); showToast('Wallpaper', 'Restored default Saturn wallpaper'); }}>
              Default Saturn
            </button>
            <button on:click={() => {
              const path = prompt('Enter image path:', '/home/sanu/Pictures/wallpaper.jpg');
              if (path) updateThemeSettings({ wallpaper: path });
            }}>
              Custom File...
            </button>
          </div>
        </div>
      </div>
    {:else if currentTab === 'display'}
      <div class="settings-section">
        <h3>Display Scaling</h3>
        <div class="settings-row">
          <div>
            <label>UI Scale</label>
            <small>Overall desktop resolution zoom</small>
          </div>
          <div style="display: flex; gap: 6px;">
            {#each [0.9, 1.0, 1.1, 1.25] as scale}
              <button
                class={$themeSettingsStore.scale === scale ? 'btn-primary' : ''}
                on:click={() => updateThemeSettings({ scale })}
              >
                {Math.round(scale * 100)}%
              </button>
            {/each}
          </div>
        </div>
      </div>
    {:else if currentTab === 'security'}
      <div class="settings-section">
        <h3>Lock Screen</h3>
        <div class="settings-row">
          <div>
            <label>Password Protection</label>
            <small>{hasPassword ? 'Password is enabled' : 'No password set (click to unlock)'}</small>
          </div>
          <button class="btn-primary" on:click={setPassword}>
            {hasPassword ? 'Change Password' : 'Set Password'}
          </button>
        </div>
      </div>
    {:else if currentTab === 'about'}
      <div class="settings-section">
        <h3>About Saturn OS</h3>
        <div class="about-card">
          <div><b>Operating System:</b> Saturn OS v2.0 (Svelte 5 + TypeScript)</div>
          <div><b>Base System:</b> Alpine Linux 3.24 (musl libc)</div>
          <div><b>Runtime:</b> Node.js v24</div>
          <hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 6px 0;" />
          <div><b>Hostname:</b> {sysinfo?.hostname || 'saturn'}</div>
          <div><b>Kernel:</b> {sysinfo?.kernel || 'Linux'}</div>
          <div><b>CPU Cores:</b> {sysinfo?.cores || 1}</div>
          <div><b>Uptime:</b> {sysinfo ? `${Math.floor(sysinfo.uptime / 3600)}h ${Math.floor((sysinfo.uptime % 3600) / 60)}m` : '0h 0m'}</div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-app {
    display: flex;
    height: 100%;
    width: 100%;
  }
  .settings-sidebar {
    width: 160px;
    background: var(--surface-1);
    border-right: 1px solid var(--border-subtle);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: none;
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12.5px;
    color: var(--text-dim);
    border: none;
    background: transparent;
    justify-content: flex-start;
  }
  .tab-btn:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
  .tab-btn.active {
    background: var(--accent);
    color: #ffffff;
  }
  :global(.tab-btn svg) {
    width: 15px;
    height: 15px;
  }
  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .settings-section h3 {
    font-size: 15px;
    font-weight: 600;
  }
  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .settings-row label {
    font-weight: 500;
    color: var(--text-main);
    display: block;
  }
  .settings-row small {
    color: var(--text-muted);
    font-size: 11.5px;
  }
  .accent-circle {
    width: 24px;
    height: 24px;
    border-radius: 12px;
    cursor: pointer;
    border: 2px solid transparent;
  }
  .accent-circle.selected {
    border-color: #ffffff;
    box-shadow: 0 0 0 1px var(--accent);
  }
  .about-card {
    background: var(--surface-1);
    border-radius: 8px;
    padding: 14px;
    font-size: 12.5px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
