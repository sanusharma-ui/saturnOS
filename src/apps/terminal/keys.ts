/**
 * Saturn OS - Terminal Keyboard Keycode & Sequence Mapper
 * Translates browser KeyboardEvents into standard ANSI / VT100 control sequences.
 */

export function mapKeyboardEventToAnsi(e: KeyboardEvent): string | null {
  // 1. Control + Key combinations
  if (e.ctrlKey && !e.altKey && !e.metaKey) {
    const key = e.key.toLowerCase();
    switch (key) {
      case 'c': return '\x03'; // SIGINT
      case 'd': return '\x04'; // EOF / Exit
      case 'l': return '\x0c'; // Clear screen
      case 'z': return '\x1a'; // SIGTSTP
      case 'a': return '\x01'; // Cursor to beginning of line
      case 'e': return '\x05'; // Cursor to end of line
      case 'u': return '\x15'; // Clear entire line before cursor
      case 'k': return '\x0b'; // Clear entire line after cursor
      case 'w': return '\x17'; // Delete word backwards
      case 'h': return '\x08'; // Backspace
      case 'j': return '\n';   // Line feed
      case 'm': return '\r';   // Carriage return
      case 'r': return '\x12'; // Reverse history search
      case 'arrowleft': return '\x1b[1;5D'; // Jump word backward
      case 'arrowright': return '\x1b[1;5C'; // Jump word forward
      case 'backspace': return '\x17'; // Delete previous word
      case 'delete': return '\x1b[3;5~'; // Delete word forward
    }
  }

  // 2. Alt + Key combinations
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const key = e.key.toLowerCase();
    switch (key) {
      case 'b': return '\x1bb'; // Word backward
      case 'f': return '\x1bf'; // Word forward
      case 'd': return '\x1bd'; // Delete word forward
      case 'backspace': return '\x1b\x7f'; // Delete word backward
    }
  }

  // 3. Shift + Key combinations
  if (e.shiftKey && !e.ctrlKey && !e.altKey) {
    if (e.key === 'Tab') return '\x1b[Z'; // Backtab
    if (e.key === 'Enter') return '\r';
  }

  // 4. Special navigation & function keys
  switch (e.key) {
    case 'Enter':
      return '\r';
    case 'Backspace':
      return '\x7f';
    case 'Tab':
      return '\t';
    case 'Escape':
      return '\x1b';
    case 'ArrowUp':
      return '\x1b[A';
    case 'ArrowDown':
      return '\x1b[B';
    case 'ArrowRight':
      return '\x1b[C';
    case 'ArrowLeft':
      return '\x1b[D';
    case 'Home':
      return '\x1b[H';
    case 'End':
      return '\x1b[F';
    case 'PageUp':
      return '\x1b[5~';
    case 'PageDown':
      return '\x1b[6~';
    case 'Delete':
      return '\x1b[3~';
    case 'Insert':
      return '\x1b[2~';
    case 'F1': return '\x1bOP';
    case 'F2': return '\x1bOQ';
    case 'F3': return '\x1bOR';
    case 'F4': return '\x1bOS';
    case 'F5': return '\x1b[15~';
    case 'F6': return '\x1b[17~';
    case 'F7': return '\x1b[18~';
    case 'F8': return '\x1b[19~';
    case 'F9': return '\x1b[20~';
    case 'F10': return '\x1b[21~';
    case 'F11': return '\x1b[23~';
    case 'F12': return '\x1b[24~';
  }

  // 5. Printable single characters (without Ctrl/Alt/Meta modifiers)
  if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
    return e.key;
  }

  return null;
}
