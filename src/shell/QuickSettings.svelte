<script lang="ts">
  import { getIconSvg } from '../assets/icons/icons';
  import { themeStore, ACCENT_PALETTE } from '../core/theme/store';
  import { api } from '../core/api/client';
  import { notifications } from '../core/notifications/store';

  interface Props {
    open: boolean;
    onclose: () => void;
    onlock: () => void;
  }

  let { open, onclose, onlock }: Props = $props();

  let volumeVal = $state(80);
  let brightnessVal = $state(100);

  async function handlePower(action: 'poweroff' | 'reboot') {
    onclose();
    try {
      await api.power(action);
    } catch (e: any) {
      notifications.add({ title: 'Power Error', message: e.message, type: 'error' });
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="qs-backdrop" onclick={onclose}>
    <div class="qs-panel" onclick={(e) => e.stopPropagation()}>
      <div class="qs-header">
        <span class="qs-title">Quick Settings</span>
        <button class="qs-close-btn" onclick={onclose}>×</button>
      </div>

      <!-- Quick Toggles Grid -->
      <div class="qs-toggles">
        <!-- Theme Toggle -->
        <button 
          class="qs-tile" 
          class:active={$themeStore.theme === 'dark'}
          onclick={() => themeStore.toggleTheme()}
        >
          <span class="tile-icon">
            {@html getIconSvg($themeStore.theme === 'dark' ? 'moon' : 'sun', 1.75)}
          </span>
          <div class="tile-labels">
            <span class="tile-title">Dark Mode</span>
            <span class="tile-sub">{$themeStore.theme === 'dark' ? 'On' : 'Off'}</span>
          </div>
        </button>

        <!-- Reduce Effects -->
        <button 
          class="qs-tile"
          class:active={$themeStore.reduceEffects}
          onclick={() => themeStore.setReduceEffects(!$themeStore.reduceEffects)}
        >
          <span class="tile-icon">
            {@html getIconSvg('effects', 1.75)}
          </span>
          <div class="tile-labels">
            <span class="tile-title">Performance</span>
            <span class="tile-sub">{$themeStore.reduceEffects ? 'Reduced FX' : 'Standard'}</span>
          </div>
        </button>
      </div>

      <!-- Sliders -->
      <div class="qs-sliders">
        <!-- Volume -->
        <div class="slider-row">
          <span class="slider-icon">
            {@html getIconSvg(volumeVal === 0 ? 'vol-mute' : 'vol', 1.75)}
          </span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            bind:value={volumeVal} 
            class="range-input"
          />
          <span class="slider-val">{volumeVal}%</span>
        </div>

        <!-- Brightness -->
        <div class="slider-row">
          <span class="slider-icon">
            {@html getIconSvg('sun', 1.75)}
          </span>
          <input 
            type="range" 
            min="20" 
            max="100" 
            bind:value={brightnessVal} 
            class="range-input"
          />
          <span class="slider-val">{brightnessVal}%</span>
        </div>
      </div>

      <!-- Accent Color Selection -->
      <div class="qs-section">
        <div class="section-title">Accent Color</div>
        <div class="accent-palette">
          {#each ACCENT_PALETTE as color}
            <button
              class="accent-pill"
              class:selected={$themeStore.accentColor === color}
              style={`background-color: ${color};`}
              onclick={() => themeStore.setAccentColor(color)}
              title={color}
            ></button>
          {/each}
        </div>
      </div>

      <!-- Bottom Actions -->
      <div class="qs-footer">
        <button class="footer-btn" onclick={() => { onclose(); onlock(); }}>
          <span class="btn-icon">{@html getIconSvg('lock', 1.75)}</span>
          Lock
        </button>
        <button class="footer-btn" onclick={() => handlePower('reboot')}>
          <span class="btn-icon">{@html getIconSvg('refresh', 1.75)}</span>
          Restart
        </button>
        <button class="footer-btn btn-danger" onclick={() => handlePower('poweroff')}>
          <span class="btn-icon">{@html getIconSvg('power', 1.75)}</span>
          Shut Down
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .qs-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 46px; /* above taskbar */
    z-index: 1001;
  }

  .qs-panel {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 340px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 16px;
    backdrop-filter: blur(24px);
    user-select: none;
    box-sizing: border-box;
  }

  .qs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .qs-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .qs-close-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
  }

  .qs-toggles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .qs-tile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .qs-tile.active {
    background: var(--accent-surface);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .tile-icon {
    width: 20px;
    height: 20px;
    display: flex;
  }

  .tile-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .tile-labels {
    display: flex;
    flex-direction: column;
  }

  .tile-title {
    font-size: 12px;
    font-weight: 600;
  }

  .tile-sub {
    font-size: 10px;
    opacity: 0.8;
  }

  .qs-sliders {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 12px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .slider-icon {
    width: 18px;
    height: 18px;
    color: var(--text-secondary);
    display: flex;
  }

  .slider-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .range-input {
    flex: 1;
    accent-color: var(--accent-primary);
    cursor: pointer;
  }

  .slider-val {
    font-size: 11px;
    color: var(--text-muted);
    width: 32px;
    text-align: right;
  }

  .qs-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .accent-palette {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .accent-pill {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .accent-pill:hover {
    transform: scale(1.15);
  }

  .accent-pill.selected {
    border-color: #ffffff;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
  }

  .qs-footer {
    display: flex;
    gap: 8px;
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 4px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }

  .footer-btn:hover {
    background: var(--bg-hover);
  }

  .footer-btn.btn-danger:hover {
    background: #ef4444;
    color: #ffffff;
  }

  .btn-icon {
    width: 14px;
    height: 14px;
    display: flex;
  }

  .btn-icon :global(svg) {
    width: 14px;
    height: 14px;
  }
</style>
