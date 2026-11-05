/**
 * Saturn OS - Terminal Screen Buffer & Scrollback History
 * Manages raw character streams, cursor carriage returns (\r),
 * backspaces (\b), line feeds (\n), and scrollback limit.
 */

import { ansiToHtml } from './ansi';

export interface TerminalBufferOptions {
  maxScrollback?: number;
  onUpdate?: () => void;
}

export class TerminalBuffer {
  public lines: string[] = [];
  public currentLine = '';
  public cursorCol = 0;

  private maxScrollback: number;
  private onUpdate?: () => void;

  constructor(options: TerminalBufferOptions = {}) {
    this.maxScrollback = options.maxScrollback || 1500;
    this.onUpdate = options.onUpdate;
  }

  /**
   * Ingests a raw chunk from stdout/stderr
   */
  public feed(chunk: string): void {
    if (!chunk) return;

    let i = 0;
    const len = chunk.length;

    while (i < len) {
      // 1. Check for ANSI Clear Screen / Line Sequences
      if (chunk.charCodeAt(i) === 0x1b && chunk[i + 1] === '[') {
        const match = chunk.substring(i).match(/^\x1b\[([0-9;?]*)([a-zA-Z])/);
        if (match) {
          const params = match[1];
          const command = match[2];
          const fullMatch = match[0];

          if (command === 'J') {
            // Clear screen: 2J = entire screen, 3J = scrollback
            if (params === '2' || params === '3' || !params) {
              this.lines = [];
              this.currentLine = '';
              this.cursorCol = 0;
            }
          } else if (command === 'K') {
            // Clear line: 2K = entire line, 0K = cursor to end
            if (params === '2' || !params) {
              this.currentLine = '';
              this.cursorCol = 0;
            } else if (params === '0') {
              this.currentLine = this.currentLine.substring(0, this.cursorCol);
            }
          } else {
            // Preserve other ANSI styling sequences in the currentLine string
            this.currentLine += fullMatch;
          }

          i += fullMatch.length;
          continue;
        }
      }

      const ch = chunk[i];

      // 2. Carriage Return + Line Feed (\r\n)
      if (ch === '\r' && chunk[i + 1] === '\n') {
        this.pushLine(this.currentLine);
        this.currentLine = '';
        this.cursorCol = 0;
        i += 2;
        continue;
      }

      // 3. Newline (\n)
      if (ch === '\n') {
        this.pushLine(this.currentLine);
        this.currentLine = '';
        this.cursorCol = 0;
        i++;
        continue;
      }

      // 4. Carriage Return (\r) - in-place overwrite for CLI progress bars
      if (ch === '\r') {
        this.cursorCol = 0;
        i++;
        continue;
      }

      // 5. Backspace (\b)
      if (ch === '\b') {
        if (this.cursorCol > 0) {
          this.cursorCol--;
          // Remove character at cursor if at end of line
          if (this.cursorCol === this.currentLine.length - 1) {
            this.currentLine = this.currentLine.slice(0, -1);
          }
        }
        i++;
        continue;
      }

      // 6. Normal character
      if (this.cursorCol < this.currentLine.length) {
        // Overwrite character at cursor position
        this.currentLine =
          this.currentLine.substring(0, this.cursorCol) +
          ch +
          this.currentLine.substring(this.cursorCol + 1);
      } else {
        // Append to current line
        this.currentLine += ch;
      }

      this.cursorCol++;
      i++;
    }

    this.onUpdate?.();
  }

  private pushLine(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.maxScrollback) {
      this.lines.splice(0, this.lines.length - this.maxScrollback);
    }
  }

  /**
   * Resets all buffer lines
   */
  public clear(): void {
    this.lines = [];
    this.currentLine = '';
    this.cursorCol = 0;
    this.onUpdate?.();
  }

  /**
   * Gets all rendered lines as HTML string array
   */
  public getHtmlLines(): string[] {
    const rendered = this.lines.map(line => ansiToHtml(line) || '&nbsp;');
    if (this.currentLine) {
      rendered.push(ansiToHtml(this.currentLine));
    }
    return rendered;
  }

  /**
   * Gets raw plain-text content (for copy/clipboard)
   */
  public getPlainText(): string {
    const all = [...this.lines];
    if (this.currentLine) all.push(this.currentLine);
    return all.join('\n');
  }
}
