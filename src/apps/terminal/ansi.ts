/**
 * Saturn OS - ANSI Terminal Escape Sequence Parser & Styler
 * Supports standard 16 colors, 256-color palette, 24-bit TrueColor,
 * and text formatting styles (bold, dim, italic, underline).
 */

export interface AnsiStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface AnsiSpan extends AnsiStyle {
  text: string;
}

// 16 Standard Terminal Colors (Atom One Dark inspired palette)
const STANDARD_COLORS: string[] = [
  '#282c34', // 0: Black
  '#e06c75', // 1: Red
  '#98c379', // 2: Green
  '#e5c07b', // 3: Yellow
  '#61afef', // 4: Blue
  '#c678dd', // 5: Magenta
  '#56b6c2', // 6: Cyan
  '#abb2bf', // 7: White
  '#5c6370', // 8: Bright Black
  '#be5046', // 9: Bright Red
  '#a8d08d', // 10: Bright Green
  '#edd08d', // 11: Bright Yellow
  '#78bbf3', // 12: Bright Blue
  '#d18ee9', // 13: Bright Magenta
  '#6fd1dc', // 14: Bright Cyan
  '#ffffff'  // 15: Bright White
];

/**
 * Resolves 256-color palette index to hex string
 */
function resolve256Color(index: number): string {
  if (index >= 0 && index < 16) {
    return STANDARD_COLORS[index];
  }
  // 16 - 231: 6x6x6 Color Cube
  if (index >= 16 && index <= 231) {
    const i = index - 16;
    const r = Math.floor(i / 36) ? (Math.floor(i / 36) * 40 + 55) : 0;
    const g = Math.floor((i % 36) / 6) ? (Math.floor((i % 36) / 6) * 40 + 55) : 0;
    const b = (i % 6) ? ((i % 6) * 40 + 55) : 0;
    return `rgb(${r},${g},${b})`;
  }
  // 232 - 255: Grayscale Ramp
  if (index >= 232 && index <= 255) {
    const gray = (index - 232) * 10 + 8;
    return `rgb(${gray},${gray},${gray})`;
  }
  return '#abb2bf';
}

/**
 * Strips all ANSI escape sequences from a string
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

/**
 * Parses raw terminal text with ANSI codes into styled spans
 */
export function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;

  let currentStyle: AnsiStyle = {};
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawText = text.substring(lastIndex, match.index);
    if (rawText) {
      spans.push({ text: rawText, ...currentStyle });
    }

    const codeStr = match[1];
    const codes = codeStr ? codeStr.split(';').map(n => parseInt(n, 10)) : [0];

    let i = 0;
    while (i < codes.length) {
      const code = codes[i];

      if (code === 0) {
        // Reset
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code === 22) {
        currentStyle.bold = false;
        currentStyle.dim = false;
      } else if (code === 23) {
        currentStyle.italic = false;
      } else if (code === 24) {
        currentStyle.underline = false;
      } else if (code >= 30 && code <= 37) {
        // Standard FG
        currentStyle.fg = STANDARD_COLORS[code - 30];
      } else if (code === 38) {
        // 256 or TrueColor FG
        if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
          currentStyle.fg = resolve256Color(codes[i + 2]);
          i += 2;
        } else if (codes[i + 1] === 2 && codes[i + 2] !== undefined && codes[i + 3] !== undefined && codes[i + 4] !== undefined) {
          currentStyle.fg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
          i += 4;
        }
      } else if (code === 39) {
        delete currentStyle.fg;
      } else if (code >= 40 && code <= 47) {
        // Standard BG
        currentStyle.bg = STANDARD_COLORS[code - 40];
      } else if (code === 48) {
        // 256 or TrueColor BG
        if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
          currentStyle.bg = resolve256Color(codes[i + 2]);
          i += 2;
        } else if (codes[i + 1] === 2 && codes[i + 2] !== undefined && codes[i + 3] !== undefined && codes[i + 4] !== undefined) {
          currentStyle.bg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
          i += 4;
        }
      } else if (code === 49) {
        delete currentStyle.bg;
      } else if (code >= 90 && code <= 97) {
        // High Intensity FG
        currentStyle.fg = STANDARD_COLORS[code - 90 + 8];
      } else if (code >= 100 && code <= 107) {
        // High Intensity BG
        currentStyle.bg = STANDARD_COLORS[code - 100 + 8];
      }

      i++;
    }

    lastIndex = regex.lastIndex;
  }

  // Trailing text
  const remaining = text.substring(lastIndex);
  if (remaining) {
    spans.push({ text: remaining, ...currentStyle });
  }

  return spans;
}

/**
 * Escapes raw HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts ANSI-encoded line directly into sanitized styled HTML
 */
export function ansiToHtml(raw: string): string {
  // Clean OSC sequences (window title, etc.)
  const cleaned = raw.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
  const spans = parseAnsi(cleaned);

  return spans
    .map(span => {
      const styles: string[] = [];
      if (span.fg) styles.push(`color:${span.fg}`);
      if (span.bg) styles.push(`background-color:${span.bg}`);
      if (span.bold) styles.push('font-weight:700');
      if (span.dim) styles.push('opacity:0.7');
      if (span.italic) styles.push('font-style:italic');
      if (span.underline) styles.push('text-decoration:underline');

      const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
      return `<span${styleAttr}>${escapeHtml(span.text)}</span>`;
    })
    .join('');
}
