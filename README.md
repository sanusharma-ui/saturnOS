# 🪐 Saturn OS

> **A high-performance, AI-first desktop environment engineered for Alpine Linux, running as a full-screen Chromium kiosk.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Frontend-Svelte%205%20(Runes)-FF3E00.svg)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%205-646CFF.svg)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20(Zero%20Dependencies)-339933.svg)](https://nodejs.org/)
[![Alpine Linux](https://img.shields.io/badge/OS-Alpine%20Linux%203.24-0D597F.svg)](https://alpinelinux.org/)

---

## 🌟 Overview

**Saturn OS** is an AI-first desktop operating system shell designed to run inside a hardware-constrained Alpine Linux environment (VirtualBox VM, VMSVGA software rendering, ~4 GB RAM, local LLM). It pairs a modular **TypeScript + Svelte 5** client compiled into an ultra-lean static bundle with a pure **Node.js built-ins backend** (zero third-party npm dependencies required on the target machine).

Saturn OS bridges the gap between traditional desktop window management and modern local AI assistance, providing a cohesive, responsive operating experience with zero external web fonts, CDNs, or telemetry.

---

## 🚀 Key Features

### 🤖 Local AI Desktop Assistant
- **Local LLM Integration**: Direct connection to an OpenAI-compatible `llama.cpp` instance running **Qwen 2.5 (1.5B)** on `http://127.0.0.1:8080`.
- **Real-Time Streaming**: Server-Sent Events (SSE) chat streaming with markdown parsing, code syntax blocks, and retry/stop controls.
- **Autonomous Tool Calling**: Natural language command execution (open apps, update appearance, search files, query live system telemetry).
- **Health Polling**: Automatic model loading detector with graceful offline state messaging.

### 💻 Integrated Multi-Tab Terminal Emulator
- **Native In-Window Terminal**: Replaces detached external windows with a full in-window terminal experience.
- **Pure Built-in RFC 6455 WebSocket Server**: Custom low-latency WebSocket transport implementation using only Node standard libraries (`crypto`, `net`, `stream`).
- **ANSI 256 & TrueColor Rendering**: Complete 16-color, 256-color cube, and 24-bit TrueColor styling engine.
- **In-Place Carriage Return (`\r`) Handling**: Flawlessly updates CLI progress bars (e.g. `curl`, `apk add`, `git clone`) without duplicate line pollution.
- **Multi-Tab Architecture**: Independent child processes (`/bin/sh` on Linux, `powershell.exe` on Windows) per tab with PID tracking, font scaling (`A-` / `A+`), and context menus.

### 🪟 Advanced Window Management
- **8-Handle Resizing**: Smooth directional scaling (`n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`) with boundary clamping.
- **Edge Snapping**: Aero-snap preview for left half, right half, and maximized full-screen views.
- **Alt + Tab Switcher**: Visual modal switcher with active card focus cycling.
- **Taskbar with Live Indicators**: Pinned apps, running indicator pills, real-time clock, volume toggle, and dynamic battery monitor (automatically hides if no battery hardware exists).

### 🎨 Modular Appearance & Themes
- **Design Token System**: CSS custom properties powered by declarative theme JSON definitions (`dark.json` / `light.json`).
- **Accent Color Palette**: Custom selectable accent highlights (Indigo, Blue, Purple, Green, Amber, Red, Teal).
- **Performance Mode**: Visual effect toggle (`reduceEffects`) that disables heavy blurs and transitions for software rendering optimization.
- **Wallpaper Engine**: Fullscreen 100vw/100vh wallpaper support with vignette masking, pre-configured with high-res Saturn photography (`saturnOS.png`).
- **Security & Lock Screen**: Full-screen lock overlay featuring clock, date, and salted SHA-256 password protection.

---

## 📦 Built-In Applications

| Application | Description |
|---|---|
| **Files** | Complete file manager with breadcrumb path navigation, grid/list view toggle, recursive search, trash management, and context menus. |
| **Terminal** | Multi-tab terminal with ANSI TrueColor rendering, VT100 control sequences, and direct shell execution. |
| **Saturn AI** | Local desktop intelligence hub with system actions, live telemetry integration, and prompt tools. |
| **Text Editor** | Multi-tab text editor with synchronized line numbering, unsaved status indicators, and keyboard shortcuts (`Ctrl+S`). |
| **Media Viewer** | Hardware-friendly media player supporting image viewing, audio playback, and video streaming with HTTP 206 Partial Content range requests. |
| **System Monitor** | Live CPU usage canvas graph (2s polling), memory/disk capacity meters, and dynamic process table. |
| **Calculator** | Comprehensive calculator with operator precedence, sign toggles, percentage calculations, and tape formula review. |
| **Clock** | Hybrid time center with smooth analog dial, digital timezone clock, lap-recording stopwatch, and countdown timer. |
| **Calendar** | Monthly agenda grid with day selection, today jump, and persistent local event notes. |
| **Settings** | Control center for theme switching, UI zoom scaling (90% to 125%), custom wallpaper configuration, and lock screen password administration. |

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd> + <kbd>Tab</kbd> | Open Alt-Tab switcher & cycle open windows |
| <kbd>Alt</kbd> + <kbd>F4</kbd> | Close currently focused window |
| <kbd>Super</kbd> / <kbd>Meta</kbd> or <kbd>Ctrl</kbd> + <kbd>Space</kbd> | Toggle Start Menu Launcher & Global Search |
| <kbd>Super</kbd> + <kbd>↑</kbd> | Maximize active window |
| <kbd>Super</kbd> + <kbd>↓</kbd> | Minimize / Restore active window |
| <kbd>Super</kbd> + <kbd>←</kbd> | Snap active window to left half |
| <kbd>Super</kbd> + <kbd>→</kbd> | Snap active window to right half |
| <kbd>Esc</kbd> | Dismiss Launcher, Quick Settings, Alt-Tab, or Context Menus |

---

## 🏗️ Architecture & Directory Structure

```text
saturnOS/
├── package.json              # Development dependencies & build scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite 5 + Svelte 5 plugin configuration
├── index.html                # Vite HTML entry point
├── deploy.ps1                # Automated PowerShell deployment script
├── deploy.cmd                # One-click deployment wrapper
├── server.js                 # Universal Node server forwarder
├── server/                   # Backend architecture (built-ins only)
│   ├── index.js              # HTTP server, routing & WebSocket upgrade router
│   ├── package.json          # CommonJS namespace configuration
│   ├── routes/
│   │   ├── fs.js             # File system CRUD & recursive search API
│   │   ├── terminal.js       # RFC 6455 WebSocket terminal transport
│   │   ├── sysinfo.js        # /proc & /sys system metrics collector
│   │   ├── power.js          # Shutdown, reboot, and session control
│   │   ├── launch.js         # Whitelisted native process spawner
│   │   ├── file.js           # HTTP 206 range-request media streamer
│   │   └── llm.js            # llama.cpp reverse proxy & health detector
│   └── lib/
│       ├── paths.js          # Safe sandboxed path resolution & traversal guard
│       ├── terminalSession.js# Child process spawn & stdio stream bridge
│       ├── sys.js            # Platform metrics parser (Linux/Windows)
│       └── mime.js           # File extension to Content-Type dictionary
├── src/                      # Client frontend architecture
│   ├── main.ts               # Svelte 5 root mounting script
│   ├── App.svelte            # Shell root layout orchestrator
│   ├── core/                 # Desktop system core
│   │   ├── api/              # Typed client-side API layer
│   │   ├── wm/               # Window manager store, snapping, and z-index engine
│   │   ├── theme/            # Theme store, token applicator, and accent palette
│   │   ├── registry/         # App manifest contracts & central registry
│   │   ├── search/           # Fuzzy search engine across apps and files
│   │   ├── terminal/         # Terminal protocol types & message schemas
│   │   ├── shortcuts/        # Global keyboard shortcut listener
│   │   ├── contextmenu/      # Viewport-bounded context menu store
│   │   └── notifications/    # System toast and notification manager
│   ├── shell/                # Desktop environment UI components
│   │   ├── Wallpaper.svelte  # Vignetted background renderer
│   │   ├── Desktop.svelte    # Shortcut grid & rubberband selection box
│   │   ├── Taskbar.svelte    # Bottom shell bar, tray, and running indicators
│   │   ├── Window.svelte     # Window frame with 8 handles & edge snapping
│   │   ├── Launcher.svelte   # Start menu with unified search
│   │   ├── QuickSettings.svelte # Control center sliders and theme toggles
│   │   ├── ContextMenu.svelte # Right-click dropdown menu
│   │   ├── AltTab.svelte     # Window switching overlay
│   │   ├── ToastContainer.svelte # Floating notification toasts
│   │   ├── LockScreen.svelte # SHA-256 unlock screen
│   │   └── BootScreen.svelte # Animated startup sequence
│   ├── apps/                 # Modular application components
│   │   ├── files/            # File manager application
│   │   ├── terminal/         # Integrated multi-tab terminal
│   │   ├── editor/           # Code & text editor
│   │   ├── viewer/           # Media player & image viewer
│   │   ├── monitor/          # Live performance monitor
│   │   ├── settings/         # Configuration center
│   │   ├── ai/               # Local LLM assistant
│   │   ├── calculator/       # Arithmetic calculator
│   │   ├── clock/            # Clock, stopwatch & timer
│   │   └── calendar/         # Monthly event calendar
│   ├── themes/               # Design token JSON definitions (dark / light)
│   └── assets/icons/         # Unified 24x24 SVG icon dictionary
├── public/
│   └── saturnOS.png          # High-resolution default Saturn wallpaper
└── dist/                     # Optimized static distribution bundle
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v20 or v24+
- **npm**: v10+

### Local Installation & Development
1. Clone the repository:
   ```bash
   git clone https://github.com/sanusharma-ui/saturnOS
   cd saturnOS
   ```

2. Install development dependencies:
   ```bash
   npm install
   ```

3. Build the static client bundle:
   ```bash
   npm run build
   ```

4. Start the backend server locally:
   ```bash
   npm start
   # Server listens on http://127.0.0.1:3000
   ```

---

## 🚢 Deployment to Alpine Linux VM

Saturn OS includes an automated deployment script (`deploy.ps1` / `deploy.cmd`) that:
1. Builds the Svelte 5 application via `npm run build`.
2. Verifies the generated `dist/` output.
3. Securely uploads `dist/`, `server/`, and `server.js` to the target VM over SSH (`saturn` alias).
4. Creates a timestamped backup of the previous deployment on the VM (retaining the last 5 versions).
5. Restarts the Node server and Chromium kiosk session cleanly.

### Deploying Latest Changes:
```powershell
.\deploy.cmd
```

### Rolling Back to the Previous Version:
```powershell
.\deploy.cmd -Rollback
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 **Sanu Sharma**.
