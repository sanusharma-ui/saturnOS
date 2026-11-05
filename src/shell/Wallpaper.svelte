<script lang="ts">
  import { themeStore } from '../core/theme/store';
</script>

<div class="wallpaper-container">
  <div 
    class="wallpaper-img" 
    style={`background-image: url('${$themeStore.wallpaper}'); filter: ${$themeStore.reduceEffects ? 'none' : 'contrast(1.02)'};`}
  ></div>
  <div class="wallpaper-vignette"></div>
</div>

<style>
  .wallpaper-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
  }

  .wallpaper-img {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    transition: filter 0.3s ease;
  }

  .wallpaper-vignette {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.45) 100%);
  }
</style>
