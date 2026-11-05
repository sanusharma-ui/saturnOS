<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { notifications } from '../../core/notifications/store';

  let activeTab = $state<'clock' | 'stopwatch' | 'timer'>('clock');

  // Clock
  let now = $state(new Date());
  let clockInterval: any;

  // Stopwatch
  let swRunning = $state(false);
  let swElapsed = $state(0);
  let swStartTime = 0;
  let swTimer: any;
  let swLaps = $state<number[]>([]);

  // Timer
  let timerDuration = $state(5 * 60); // 5 mins default
  let timerRemaining = $state(5 * 60);
  let timerRunning = $state(false);
  let timerInterval: any;
  let timerInputMins = $state(5);
  let timerInputSecs = $state(0);

  onMount(() => {
    clockInterval = setInterval(() => {
      now = new Date();
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(clockInterval);
    clearInterval(swTimer);
    clearInterval(timerInterval);
  });

  // Stopwatch logic
  function toggleStopwatch() {
    if (swRunning) {
      clearInterval(swTimer);
      swRunning = false;
    } else {
      swStartTime = Date.now() - swElapsed;
      swRunning = true;
      swTimer = setInterval(() => {
        swElapsed = Date.now() - swStartTime;
      }, 50);
    }
  }

  function resetStopwatch() {
    clearInterval(swTimer);
    swRunning = false;
    swElapsed = 0;
    swLaps = [];
  }

  function lapStopwatch() {
    if (swRunning) {
      swLaps = [swElapsed, ...swLaps];
    }
  }

  function formatStopwatch(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  // Timer logic
  function setTimerPreset(mins: number) {
    timerRunning = false;
    clearInterval(timerInterval);
    timerDuration = mins * 60;
    timerRemaining = timerDuration;
    timerInputMins = mins;
    timerInputSecs = 0;
  }

  function toggleTimer() {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerRunning = false;
    } else {
      if (timerRemaining <= 0) {
        timerDuration = (timerInputMins * 60) + timerInputSecs;
        timerRemaining = timerDuration;
      }
      if (timerRemaining <= 0) return;
      timerRunning = true;
      timerInterval = setInterval(() => {
        if (timerRemaining > 1) {
          timerRemaining -= 1;
        } else {
          timerRemaining = 0;
          timerRunning = false;
          clearInterval(timerInterval);
          notifications.add({
            title: 'Timer Complete',
            message: 'Your timer has finished!',
            type: 'info'
          });
        }
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerDuration = (timerInputMins * 60) + timerInputSecs;
    timerRemaining = timerDuration;
  }

  function formatTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Analog Clock angles
  let secAngle = $derived((now.getSeconds() / 60) * 360);
  let minAngle = $derived(((now.getMinutes() + now.getSeconds() / 60) / 60) * 360);
  let hrAngle = $derived((((now.getHours() % 12) + now.getMinutes() / 60) / 12) * 360);
</script>

<div class="clock-app">
  <div class="clock-nav">
    <button class="nav-btn" class:active={activeTab === 'clock'} onclick={() => activeTab = 'clock'}>Clock</button>
    <button class="nav-btn" class:active={activeTab === 'stopwatch'} onclick={() => activeTab = 'stopwatch'}>Stopwatch</button>
    <button class="nav-btn" class:active={activeTab === 'timer'} onclick={() => activeTab = 'timer'}>Timer</button>
  </div>

  <div class="clock-content">
    {#if activeTab === 'clock'}
      <div class="tab-clock">
        <div class="analog-face">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" class="dial-bg" />
            {#each Array(12) as _, i}
              <line 
                x1="50" y1="8" x2="50" y2="12" 
                class="dial-mark"
                transform={`rotate(${i * 30} 50 50)`} 
              />
            {/each}
            <!-- Hands -->
            <line x1="50" y1="50" x2="50" y2="26" class="hand hr-hand" transform={`rotate(${hrAngle} 50 50)`} />
            <line x1="50" y1="50" x2="50" y2="16" class="hand min-hand" transform={`rotate(${minAngle} 50 50)`} />
            <line x1="50" y1="54" x2="50" y2="12" class="hand sec-hand" transform={`rotate(${secAngle} 50 50)`} />
            <circle cx="50" cy="50" r="3" class="dial-center" />
          </svg>
        </div>
        <div class="digital-time">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div class="digital-date">
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

    {:else if activeTab === 'stopwatch'}
      <div class="tab-stopwatch">
        <div class="sw-time">{formatStopwatch(swElapsed)}</div>
        <div class="sw-actions">
          <button class="btn btn-primary" onclick={toggleStopwatch}>
            {swRunning ? 'Pause' : 'Start'}
          </button>
          {#if swRunning}
            <button class="btn" onclick={lapStopwatch}>Lap</button>
          {:else}
            <button class="btn" onclick={resetStopwatch} disabled={swElapsed === 0}>Reset</button>
          {/if}
        </div>
        {#if swLaps.length > 0}
          <div class="sw-laplist">
            {#each swLaps as lap, idx}
              <div class="lap-row">
                <span class="lap-num">Lap {swLaps.length - idx}</span>
                <span class="lap-time">{formatStopwatch(lap)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'timer'}
      <div class="tab-timer">
        <div class="timer-display">{formatTimer(timerRemaining)}</div>
        <div class="timer-progress">
          <div class="progress-fill" style={`width: ${timerDuration ? (timerRemaining / timerDuration) * 100 : 0}%`}></div>
        </div>

        <div class="timer-presets">
          <button class="preset-btn" onclick={() => setTimerPreset(1)}>1m</button>
          <button class="preset-btn" onclick={() => setTimerPreset(5)}>5m</button>
          <button class="preset-btn" onclick={() => setTimerPreset(15)}>15m</button>
          <button class="preset-btn" onclick={() => setTimerPreset(30)}>30m</button>
        </div>

        <div class="timer-actions">
          <button class="btn btn-primary" onclick={toggleTimer}>
            {timerRunning ? 'Pause' : 'Start'}
          </button>
          <button class="btn" onclick={resetTimer}>Reset</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .clock-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-window);
    box-sizing: border-box;
    user-select: none;
  }

  .clock-nav {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    padding: 4px 12px 0;
    gap: 8px;
    background: var(--bg-surface);
  }

  .nav-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }

  .nav-btn:hover {
    color: var(--text-primary);
  }

  .nav-btn.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
  }

  .clock-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .tab-clock {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .analog-face {
    width: 180px;
    height: 180px;
  }

  .dial-bg {
    fill: var(--bg-card);
    stroke: var(--border-color);
    stroke-width: 2;
  }

  .dial-mark {
    stroke: var(--text-muted);
    stroke-width: 2;
  }

  .hand {
    stroke-linecap: round;
  }

  .hr-hand {
    stroke: var(--text-primary);
    stroke-width: 4;
  }

  .min-hand {
    stroke: var(--text-secondary);
    stroke-width: 3;
  }

  .sec-hand {
    stroke: var(--accent-primary);
    stroke-width: 1.5;
  }

  .dial-center {
    fill: var(--accent-primary);
  }

  .digital-time {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.5px;
  }

  .digital-date {
    font-size: 14px;
    color: var(--text-muted);
  }

  /* Stopwatch */
  .tab-stopwatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 20px;
  }

  .sw-time {
    font-size: 40px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: monospace;
  }

  .sw-actions, .timer-actions {
    display: flex;
    gap: 12px;
  }

  .btn {
    padding: 8px 20px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--accent-primary);
    color: #fff;
    border-color: var(--accent-primary);
  }

  .sw-laplist {
    width: 100%;
    max-height: 140px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 4px;
  }

  .lap-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    font-size: 13px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  /* Timer */
  .tab-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 16px;
  }

  .timer-display {
    font-size: 48px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: monospace;
  }

  .timer-progress {
    width: 100%;
    height: 6px;
    background: var(--bg-card);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-primary);
    transition: width 0.3s;
  }

  .timer-presets {
    display: flex;
    gap: 8px;
  }

  .preset-btn {
    padding: 6px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
  }
</style>
