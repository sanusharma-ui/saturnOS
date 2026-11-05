<script lang="ts">
  import { getIconSvg } from '../assets/icons/icons';

  interface Props {
    title: string;
    icon: string;
    selected?: boolean;
    onselect?: () => void;
    onlaunch: () => void;
    oncontextmenu?: (e: MouseEvent) => void;
  }

  let { title, icon, selected = false, onselect, onlaunch, oncontextmenu }: Props = $props();

  let clickTimeout: any;

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    onselect?.();
  }

  function handleDblClick(e: MouseEvent) {
    e.stopPropagation();
    onlaunch();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="desktop-icon" 
  class:selected
  onclick={handleClick}
  ondblclick={handleDblClick}
  oncontextmenu={oncontextmenu}
>
  <div class="icon-glyph">
    {@html getIconSvg(icon, 1.75)}
  </div>
  <div class="icon-label">
    {title}
  </div>
</div>

<style>
  .desktop-icon {
    width: 80px;
    height: 84px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--radius-sm);
    padding: 6px 4px;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
    border: 1px solid transparent;
  }

  .desktop-icon:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .desktop-icon.selected {
    background: var(--accent-surface);
    border-color: var(--accent-primary);
  }

  .icon-glyph {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  }

  .icon-glyph :global(svg) {
    width: 36px;
    height: 36px;
  }

  .icon-label {
    font-size: 11px;
    font-weight: 500;
    color: #ffffff;
    text-align: center;
    word-break: break-word;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.6);
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
