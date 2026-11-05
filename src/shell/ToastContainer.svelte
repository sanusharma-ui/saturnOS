<script lang="ts">
  import { notifications } from '../core/notifications/store';
  import { getIconSvg } from '../assets/icons/icons';
</script>

<div class="toast-container">
  {#each $notifications as item (item.id)}
    <div class="toast-item {item.type}">
      <div class="toast-icon">
        {@html getIconSvg(item.type === 'error' ? 'close' : item.type === 'warn' ? 'settings' : 'bell', 1.75)}
      </div>
      <div class="toast-content">
        <div class="toast-title">{item.title}</div>
        <div class="toast-msg">{item.message}</div>
      </div>
      <button class="toast-close" onclick={() => notifications.remove(item.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 58px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100000;
    pointer-events: none;
    max-width: 320px;
  }

  .toast-item {
    pointer-events: auto;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    user-select: none;
    animation: toast-in 0.2s ease-out;
    backdrop-filter: blur(16px);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .toast-icon {
    width: 18px;
    height: 18px;
    color: var(--accent-primary);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .toast-item.error .toast-icon {
    color: #ef4444;
  }

  .toast-item.warn .toast-icon {
    color: #f59e0b;
  }

  .toast-content {
    flex: 1;
    overflow: hidden;
  }

  .toast-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .toast-msg {
    font-size: 12px;
    color: var(--text-secondary);
    word-break: break-word;
    margin-top: 2px;
    line-height: 1.3;
  }

  .toast-close {
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
  }

  .toast-close:hover {
    color: var(--text-primary);
  }
</style>
