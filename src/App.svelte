<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Wallpaper from './shell/Wallpaper.svelte';
  import Desktop from './shell/Desktop.svelte';
  import Taskbar from './shell/Taskbar.svelte';
  import Window from './shell/Window.svelte';
  import SnapPreview from './shell/SnapPreview.svelte';
  import AltTab from './shell/AltTab.svelte';
  import Launcher from './shell/Launcher.svelte';
  import QuickSettings from './shell/QuickSettings.svelte';
  import ContextMenu from './shell/ContextMenu.svelte';
  import ToastContainer from './shell/ToastContainer.svelte';
  import LockScreen from './shell/LockScreen.svelte';
  import BootScreen from './shell/BootScreen.svelte';

  import { windowsStore, activeWindowIdStore } from './core/wm/store';
  import { setupKeyboardShortcuts, registerShortcutCallbacks } from './core/shortcuts/keyboard';
  import { themeSettingsStore, applyTheme } from './core/theme/store';
  import { get } from 'svelte/store';

  let booted = $state(false);
  let locked = $state(false);
  let launcherOpen = $state(false);
  let quickSettingsOpen = $state(false);

  let cleanupShortcuts: (() => void) | null = null;

  onMount(() => {
    // Apply current theme settings
    applyTheme(get(themeSettingsStore));

    // Register shortcut callbacks
    registerShortcutCallbacks({
      toggleLauncher: () => {
        launcherOpen = !launcherOpen;
        if (launcherOpen) quickSettingsOpen = false;
      },
      closeLauncher: () => {
        launcherOpen = false;
      },
      toggleQuickSettings: () => {
        quickSettingsOpen = !quickSettingsOpen;
        if (quickSettingsOpen) launcherOpen = false;
      },
      closeQuickSettings: () => {
        quickSettingsOpen = false;
      }
    });

    // Start keyboard shortcut listeners
    cleanupShortcuts = setupKeyboardShortcuts();
  });

  onDestroy(() => {
    cleanupShortcuts?.();
  });

  function handleDesktopClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (target.closest('.taskbar') || target.closest('.launcher-panel') || target.closest('.qs-panel') || target.closest('.ctx-menu')) {
      return;
    }
    launcherOpen = false;
    quickSettingsOpen = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main class="saturn-desktop-root" onclick={handleDesktopClick}>
  <!-- 1. Background Wallpaper -->
  <Wallpaper />

  <!-- 2. Desktop Workspace & Grid Icons -->
  <Desktop />

  <!-- 3. Active Windows -->
  {#each $windowsStore as win (win.id)}
    <Window win={win} active={win.id === $activeWindowIdStore} />
  {/each}

  <!-- 4. Window Snapping Preview Outline -->
  <SnapPreview />

  <!-- 5. Alt-Tab Overlay -->
  <AltTab />

  <!-- 6. Bottom Shell Taskbar -->
  <Taskbar
    {launcherOpen}
    {quickSettingsOpen}
    ontoggleLauncher={() => {
      launcherOpen = !launcherOpen;
      if (launcherOpen) quickSettingsOpen = false;
    }}
    onOpenSearch={() => {
      launcherOpen = true;
      quickSettingsOpen = false;
    }}
    ontoggleQuickSettings={() => {
      quickSettingsOpen = !quickSettingsOpen;
      if (quickSettingsOpen) launcherOpen = false;
    }}
  />

  <!-- 7. Start Menu Launcher & Global Search -->
  <Launcher
    open={launcherOpen}
    onclose={() => launcherOpen = false}
    onlock={() => locked = true}
  />

  <!-- 8. Control Center Quick Settings -->
  <QuickSettings
    open={quickSettingsOpen}
    onclose={() => quickSettingsOpen = false}
    onlock={() => locked = true}
  />

  <!-- 9. Right-Click Context Menu -->
  <ContextMenu />

  <!-- 10. Toast Notifications -->
  <ToastContainer />

  <!-- 11. Lock Screen Overlay -->
  <LockScreen
    {locked}
    onunlock={() => locked = false}
  />

  <!-- 12. Initial Boot Screen Animation -->
  {#if !booted}
    <BootScreen onfinish={() => booted = true} />
  {/if}
</main>

<style>
  .saturn-desktop-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--text-primary, #ffffff);
  }
</style>
