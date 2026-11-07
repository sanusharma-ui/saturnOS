/**
 * Saturn OS - Terminal Screen Buffer & Scrollback History
 * High-performance cell-based line buffer supporting VT100/ANSI sequences,
 * in-place carriage returns (\r), cursor movements, and TrueColor styles.
 */

import { ansiToHtml } from './ansi';

export interface TerminalBufferOptions {
  maxScrollback?: number;
  onUpdate?: () => void;
}

interface Cell {
  char: string;
  ansi: string;
}

export class TerminalBuffer {
  public lines: string[] = [];
  public currentCells: Cell[] = [];
  public cursorCol = 0;

  private maxScrollback: number;
  private onUpdate?: () => void;
  private currentAnsi = '';

  constructor(options: TerminalBufferOptions = {}) {
    this.maxScrollback = options.maxScrollback || 2000;
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
      const code = chunk.charCodeAt(i);

      // 1. ANSI Escape Sequence (\x1b...)
      if (code === 0x1b) {
        // OSC Sequence (\x1b]...BEL or ST) - typically window title
        if (chunk[i + 1] === ']') {
          let j = i + 2;
          while (j < len && chunk[j] !== '\x07' && !(chunk[j] === '\x1b' && chunk[j + 1] === '\\')) {
            j++;
          }
          if (j < len) {
            i = chunk[j] === '\x07' ? j + 1 : j + 2;
            continue;
          }
        }

        // CSI Sequence (\x1b[...)
        if (chunk[i + 1] === '[') {
          const sub = chunk.substring(i);
          const match = sub.match(/^\x1b\[([?0-9;]*)([a-zA-Z])/);
          if (match) {
            const params = match[1] || '';
            const cmd = match[2];
            const fullMatch = match[0];

            if (cmd === 'm') {
              // Styling / Colors
              if (params === '' || params === '0') {
                this.currentAnsi = '\x1b[0m';
              } else {
                this.currentAnsi += fullMatch;
              }
            } else if (cmd === 'J') {
              // Clear screen / scrollback
              if (params === '2' || params === '3' || !params) {
                this.lines = [];
                this.currentCells = [];
                this.cursorCol = 0;
              }
            } else if (cmd === 'K') {
              // Clear in line
              if (params === '2') {
                // Clear entire line
                this.currentCells = [];
                this.cursorCol = 0;
              } else if (params === '1') {
                // Clear from beginning to cursor
                for (let c = 0; c <= this.cursorCol && c < this.currentCells.length; c++) {
                  this.currentCells[c] = { char: ' ', ansi: '' };
                }
              } else {
                // Clear from cursor to end
                this.currentCells.splice(this.cursorCol);
              }
            } else if (cmd === 'C') {
              // Cursor Forward
              const count = parseInt(params, 10) || 1;
              this.cursorCol += count;
            } else if (cmd === 'D') {
              // Cursor Backward
              const count = parseInt(params, 10) || 1;
              this.cursorCol = Math.max(0, this.cursorCol - count);
            } else if (cmd === 'H' || cmd === 'f') {
              // Cursor Position (row;col)
              const parts = params.split(';');
              const col = parseInt(parts[1] || '1', 10) - 1;
              this.cursorCol = Math.max(0, col);
            }

            i += fullMatch.length;
            continue;
          }
        }
      }

      const ch = chunk[i];

      // 2. Carriage Return + Line Feed (\r\n)
      if (ch === '\r' && chunk[i + 1] === '\n') {
        this.commitCurrentLine();
        i += 2;
        continue;
      }

      // 3. Line Feed (\n)
      if (ch === '\n') {
        this.commitCurrentLine();
        i++;
        continue;
      }

      // 4. Carriage Return (\r) - in-place overwrite for progress bars / CLI spinners
      if (ch === '\r') {
        this.cursorCol = 0;
        i++;
        continue;
      }

      // 5. Backspace (\b or \x7f)
      if (ch === '\b' || code === 0x7f) {
        if (this.cursorCol > 0) {
          this.cursorCol--;
          if (this.cursorCol === this.currentCells.length - 1) {
            this.currentCells.pop();
          }
        }
        i++;
        continue;
      }

      // 6. Tab (\t) -> advance to next multiple of 4
      if (ch === '\t') {
        const nextStop = Math.floor((this.cursorCol + 4) / 4) * 4;
        while (this.cursorCol < nextStop) {
          this.writeCell(' ');
        }
        i++;
        continue;
      }

      // 7. Regular printable character
      if (code >= 32 || code === 0x1b) {
        this.writeCell(ch);
      }

      i++;
    }

    this.onUpdate?.();
  }

  private writeCell(ch: string): void {
    // Fill gaps if cursorCol jumped forward
    while (this.currentCells.length < this.cursorCol) {
      this.currentCells.push({ char: ' ', ansi: '' });
    }

    this.currentCells[this.cursorCol] = {
      char: ch,
      ansi: this.currentAnsi
    };
    this.cursorCol++;
  }

  private commitCurrentLine(): void {
    const rawLine = this.cellsToAnsiString(this.currentCells);
    this.pushLine(rawLine);
    this.currentCells = [];
    this.cursorCol = 0;
  }

  private cellsToAnsiString(cells: Cell[]): string {
    if (cells.length === 0) return '';
    let out = '';
    let lastAnsi = '';
    for (const cell of cells) {
      if (cell.ansi !== lastAnsi) {
        out += cell.ansi;
        lastAnsi = cell.ansi;
      }
      out += cell.char;
    }
    if (lastAnsi && !lastAnsi.endsWith('\x1b[0m')) {
      out += '\x1b[0m';
    }
    return out;
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
    this.currentCells = [];
    this.cursorCol = 0;
    this.currentAnsi = '';
    this.onUpdate?.();
  }

  /**
   * Gets all rendered lines as HTML string array
   */
  public getHtmlLines(): string[] {
    const rendered = this.lines.map(line => ansiToHtml(line) || '&nbsp;');
    // Add active line being edited
    const activeRaw = this.cellsToAnsiString(this.currentCells);
    rendered.push(ansiToHtml(activeRaw) || '&nbsp;');
    return rendered;
  }
}
