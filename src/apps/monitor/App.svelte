<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api, type SysInfo } from '../../core/api/client';

  let sysinfo: SysInfo | null = null;
  let canvasEl: HTMLCanvasElement;
  let cpuHistory: number[] = [];
  const maxHistory = 40;
  let intervalId: any = null;

  function formatBytes(bytes: number) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function drawCpuChart() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    cpuHistory.forEach((val, i) => {
      const x = (i / (maxHistory - 1)) * canvasEl.width;
      const y = canvasEl.height - (val / 100) * (canvasEl.height - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  async function poll() {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const data = await api.getSysinfo();
      sysinfo = data;
      cpuHistory.push(data.cpu || 0);
      if (cpuHistory.length > maxHistory) cpuHistory.shift();
      drawCpuChart();
    } catch (e) {}
  }

  onMount(() => {
    poll();
    intervalId = setInterval(poll, 2000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  $: memUsed = sysinfo ? sysinfo.mem.total - sysinfo.mem.avail : 0;
  $: memPct = sysinfo && sysinfo.mem.total > 0 ? Math.round((memUsed / sysinfo.mem.total) * 100) : 0;
  $: diskUsed = sysinfo ? sysinfo.disk.total - sysinfo.disk.free : 0;
  $: diskPct = sysinfo && sysinfo.disk.total > 0 ? Math.round((diskUsed / sysinfo.disk.total) * 100) : 0;
</script>

<div class="monitor-app">
  <!-- CPU Section -->
  <div class="monitor-card">
    <div class="monitor-card-header">
      <span>CPU History ({sysinfo?.cores || 1} cores)</span>
      <span class="cpu-stat-val">{sysinfo ? sysinfo.cpu : 0}%</span>
    </div>
    <canvas bind:this={canvasEl} width="580" height="90" class="monitor-chart-canvas"></canvas>
  </div>

  <!-- Memory & Disk Section -->
  <div class="gauge-grid">
    <div class="monitor-card">
      <div class="monitor-card-header">
        <span>Memory</span>
        <span>{memPct}%</span>
      </div>
      <div class="gauge-sub">
        {sysinfo ? `${formatBytes(memUsed)} of ${formatBytes(sysinfo.mem.total)}` : '0 / 0'}
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {memPct}%;"></div>
      </div>
    </div>

    <div class="monitor-card">
      <div class="monitor-card-header">
        <span>Disk Storage</span>
        <span>{diskPct}%</span>
      </div>
      <div class="gauge-sub">
        {sysinfo ? `${formatBytes(diskUsed)} of ${formatBytes(sysinfo.disk.total)}` : '0 / 0'}
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {diskPct}%;"></div>
      </div>
    </div>
  </div>

  <!-- Processes Section -->
  <div class="monitor-card">
    <div class="monitor-card-header">
      <span>Top Processes</span>
    </div>
    <table class="proc-table">
      <thead>
        <tr><th>PID</th><th>Process</th><th>CPU %</th><th>Memory</th></tr>
      </thead>
      <tbody>
        {#if sysinfo && sysinfo.procs}
          {#each sysinfo.procs as proc}
            <tr>
              <td>{proc.pid}</td>
              <td style="font-weight: 500;">{proc.name}</td>
              <td>{proc.cpu}%</td>
              <td>{formatBytes(proc.mem)}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  .monitor-app {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }
  .monitor-card {
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .monitor-card-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 12.5px;
  }
  .cpu-stat-val {
    color: var(--accent);
  }
  .monitor-chart-canvas {
    width: 100%;
    height: 90px;
    border-radius: 6px;
    background: var(--surface-solid);
  }
  .gauge-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .gauge-sub {
    font-size: 11.5px;
    color: var(--text-dim);
    margin-bottom: 6px;
  }
  .progress-bar {
    height: 8px;
    background: var(--surface-solid);
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.3s ease-out;
  }
  .proc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }
  .proc-table th, .proc-table td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }
</style>
