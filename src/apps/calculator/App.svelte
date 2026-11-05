<script lang="ts">
  let display = $state('0');
  let equation = $state('');
  let clearNext = $state(false);

  function inputDigit(digit: string) {
    if (clearNext) {
      display = digit;
      clearNext = false;
    } else {
      display = display === '0' ? digit : display + digit;
    }
  }

  function inputDot() {
    if (clearNext) {
      display = '0.';
      clearNext = false;
      return;
    }
    if (!display.includes('.')) {
      display += '.';
    }
  }

  function handleOp(op: string) {
    clearNext = true;
    equation = `${display} ${op} `;
  }

  function toggleSign() {
    if (display === '0') return;
    if (display.startsWith('-')) {
      display = display.substring(1);
    } else {
      display = '-' + display;
    }
  }

  function percentage() {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      display = String(val / 100);
    }
  }

  function clear() {
    display = '0';
    equation = '';
    clearNext = false;
  }

  function backspace() {
    if (clearNext) return;
    if (display.length > 1) {
      display = display.slice(0, -1);
    } else {
      display = '0';
    }
  }

  function calculate() {
    if (!equation) return;
    const fullExpr = equation + display;
    try {
      // Safe math evaluation with tokens
      const parts = fullExpr.trim().split(/\s+/);
      if (parts.length >= 3) {
        let result = parseFloat(parts[0]);
        for (let i = 1; i < parts.length; i += 2) {
          const op = parts[i];
          const nextVal = parseFloat(parts[i + 1]);
          if (isNaN(nextVal)) continue;
          if (op === '+') result += nextVal;
          else if (op === '-') result -= nextVal;
          else if (op === '×' || op === '*') result *= nextVal;
          else if (op === '÷' || op === '/') {
            if (nextVal === 0) {
              display = 'Error';
              equation = '';
              clearNext = true;
              return;
            }
            result /= nextVal;
          }
        }
        equation = fullExpr + ' =';
        // Limit precision nicely
        display = Number.isInteger(result) ? String(result) : parseFloat(result.toFixed(8)).toString();
        clearNext = true;
      }
    } catch {
      display = 'Error';
      equation = '';
      clearNext = true;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
    } else if (e.key === '.') {
      inputDot();
    } else if (e.key === '+' || e.key === '-') {
      handleOp(e.key);
    } else if (e.key === '*') {
      handleOp('×');
    } else if (e.key === '/') {
      e.preventDefault();
      handleOp('÷');
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      calculate();
    } else if (e.key === 'Backspace') {
      backspace();
    } else if (e.key === 'Escape') {
      clear();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="calc-container" tabindex="0" onkeydown={handleKeyDown}>
  <div class="calc-screen">
    <div class="calc-equation">{equation}</div>
    <div class="calc-display">{display}</div>
  </div>

  <div class="calc-grid">
    <button class="calc-btn btn-func" onclick={clear}>C</button>
    <button class="calc-btn btn-func" onclick={toggleSign}>±</button>
    <button class="calc-btn btn-func" onclick={percentage}>%</button>
    <button class="calc-btn btn-op" onclick={() => handleOp('÷')}>÷</button>

    <button class="calc-btn" onclick={() => inputDigit('7')}>7</button>
    <button class="calc-btn" onclick={() => inputDigit('8')}>8</button>
    <button class="calc-btn" onclick={() => inputDigit('9')}>9</button>
    <button class="calc-btn btn-op" onclick={() => handleOp('×')}>×</button>

    <button class="calc-btn" onclick={() => inputDigit('4')}>4</button>
    <button class="calc-btn" onclick={() => inputDigit('5')}>5</button>
    <button class="calc-btn" onclick={() => inputDigit('6')}>6</button>
    <button class="calc-btn btn-op" onclick={() => handleOp('-')}>−</button>

    <button class="calc-btn" onclick={() => inputDigit('1')}>1</button>
    <button class="calc-btn" onclick={() => inputDigit('2')}>2</button>
    <button class="calc-btn" onclick={() => inputDigit('3')}>3</button>
    <button class="calc-btn btn-op" onclick={() => handleOp('+')}>+</button>

    <button class="calc-btn btn-zero" onclick={() => inputDigit('0')}>0</button>
    <button class="calc-btn" onclick={inputDot}>.</button>
    <button class="calc-btn btn-op btn-equals" onclick={calculate}>=</button>
  </div>
</div>

<style>
  .calc-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-window);
    padding: 16px;
    box-sizing: border-box;
    gap: 12px;
    outline: none;
    user-select: none;
  }

  .calc-screen {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
    min-height: 72px;
  }

  .calc-equation {
    font-size: 13px;
    color: var(--text-muted);
    min-height: 18px;
    word-break: break-all;
  }

  .calc-display {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary);
    word-break: break-all;
    line-height: 1.2;
  }

  .calc-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    flex: 1;
  }

  .calc-btn {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.05s;
  }

  .calc-btn:hover {
    background: var(--bg-hover);
  }

  .calc-btn:active {
    transform: scale(0.96);
  }

  .btn-func {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
  }

  .btn-op {
    background: var(--accent-surface);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .btn-op:hover {
    background: var(--accent-primary);
    color: #fff;
  }

  .btn-equals {
    background: var(--accent-primary);
    color: #fff;
  }

  .btn-equals:hover {
    opacity: 0.9;
  }
</style>
