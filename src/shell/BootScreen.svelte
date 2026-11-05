<script lang="ts">
  import { onMount } from 'svelte';
  import { getIconSvg } from '../assets/icons/icons';

  interface Props {
    onfinish: () => void;
  }

  let { onfinish }: Props = $props();

  let fading = $state(false);

  onMount(() => {
    const timer = setTimeout(() => {
      fading = true;
      setTimeout(onfinish, 400);
    }, 1800);

    return () => clearTimeout(timer);
  });
</script>

<div class="bootscreen-container" class:fading>
  <div class="boot-logo">
    {@html getIconSvg('saturn', 1.5)}
  </div>
  <div class="boot-title">Saturn OS</div>
  <div class="boot-sub">AI-First Desktop Environment</div>
  <div class="boot-spinner"></div>
</div>

<style>
  .bootscreen-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999999;
    background: #090a0f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    user-select: none;
    transition: opacity 0.4s ease-out;
  }

  .bootscreen-container.fading {
    opacity: 0;
    pointer-events: none;
  }

  .boot-logo {
    width: 64px;
    height: 64px;
    color: var(--accent-primary, #6366f1);
    animation: pulse-ring 2s infinite ease-in-out;
  }

  .boot-logo :global(svg) {
    width: 64px;
    height: 64px;
  }

  @keyframes pulse-ring {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.4)); }
    50% { transform: scale(1.08); filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.8)); }
  }

  .boot-title {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .boot-sub {
    font-size: 13px;
    color: #94a3b8;
    letter-spacing: 0.5px;
  }

  .boot-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent-primary, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-top: 20px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
