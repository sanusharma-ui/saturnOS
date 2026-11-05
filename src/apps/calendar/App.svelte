<script lang="ts">
  import { onMount } from 'svelte';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let today = new Date();
  let currentYear = $state(today.getFullYear());
  let currentMonth = $state(today.getMonth());
  let selectedDate = $state(new Date());

  // Notes/events map: 'YYYY-MM-DD' -> string[]
  let eventsMap = $state<Record<string, string[]>>({});
  let newEventText = $state('');

  onMount(() => {
    try {
      const stored = localStorage.getItem('saturn_calendar_events');
      if (stored) {
        eventsMap = JSON.parse(stored);
      }
    } catch {}
  });

  function saveEvents() {
    try {
      localStorage.setItem('saturn_calendar_events', JSON.stringify(eventsMap));
    } catch {}
  }

  function formatDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  let selectedKey = $derived(formatDateKey(selectedDate));
  let selectedEvents = $derived(eventsMap[selectedKey] || []);

  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else {
      currentMonth -= 1;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear += 1;
    } else {
      currentMonth += 1;
    }
  }

  function goToday() {
    today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDate = new Date();
  }

  function selectDay(day: number) {
    selectedDate = new Date(currentYear, currentMonth, day);
  }

  function addEvent() {
    if (!newEventText.trim()) return;
    const list = eventsMap[selectedKey] ? [...eventsMap[selectedKey]] : [];
    list.push(newEventText.trim());
    eventsMap = { ...eventsMap, [selectedKey]: list };
    newEventText = '';
    saveEvents();
  }

  function removeEvent(idx: number) {
    const list = [...(eventsMap[selectedKey] || [])];
    list.splice(idx, 1);
    if (list.length === 0) {
      const copy = { ...eventsMap };
      delete copy[selectedKey];
      eventsMap = copy;
    } else {
      eventsMap = { ...eventsMap, [selectedKey]: list };
    }
    saveEvents();
  }

  // Days calculation
  let calendarDays = $derived.by(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const days: { day: number; currentMonth: boolean; key: string }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 0 ? 11 : currentMonth - 1;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      days.push({ day: d, currentMonth: false, key: formatDateKey(new Date(y, m, d)) });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, currentMonth: true, key: formatDateKey(new Date(currentYear, currentMonth, i)) });
    }

    // Next month padding to fill complete weeks
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({ day: i, currentMonth: false, key: formatDateKey(new Date(y, m, i)) });
    }

    return days;
  });
</script>

<div class="calendar-app">
  <div class="cal-header">
    <div class="header-left">
      <span class="month-title">{MONTHS[currentMonth]} {currentYear}</span>
      <button class="nav-btn" onclick={prevMonth} aria-label="Previous Month">◀</button>
      <button class="nav-btn" onclick={nextMonth} aria-label="Next Month">▶</button>
    </div>
    <button class="today-btn" onclick={goToday}>Today</button>
  </div>

  <div class="cal-body">
    <div class="cal-grid-header">
      {#each DAYS as day}
        <div class="day-name">{day}</div>
      {/each}
    </div>

    <div class="cal-days-grid">
      {#each calendarDays as d}
        {@const isToday = d.key === formatDateKey(new Date())}
        {@const isSelected = d.key === selectedKey}
        {@const hasEvents = (eventsMap[d.key]?.length || 0) > 0}
        <button
          class="day-cell"
          class:other-month={!d.currentMonth}
          class:is-today={isToday}
          class:is-selected={isSelected}
          onclick={() => {
            if (d.currentMonth) selectDay(d.day);
          }}
        >
          <span class="day-num">{d.day}</span>
          {#if hasEvents}
            <span class="event-dot"></span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Notes & Events Section -->
    <div class="events-pane">
      <div class="events-title">
        Events for {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      <div class="events-list">
        {#if selectedEvents.length === 0}
          <div class="no-events">No events scheduled.</div>
        {:else}
          {#each selectedEvents as ev, idx}
            <div class="event-item">
              <span class="event-bullet">•</span>
              <span class="event-text">{ev}</span>
              <button class="del-ev-btn" onclick={() => removeEvent(idx)}>×</button>
            </div>
          {/each}
        {/if}
      </div>

      <form class="event-add-form" onsubmit={(e) => { e.preventDefault(); addEvent(); }}>
        <input 
          type="text" 
          placeholder="Add an event or note..." 
          bind:value={newEventText} 
          class="event-input"
        />
        <button type="submit" class="add-btn">Add</button>
      </form>
    </div>
  </div>
</div>

<style>
  .calendar-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-window);
    box-sizing: border-box;
    padding: 16px;
    gap: 16px;
    user-select: none;
    overflow-y: auto;
  }

  .cal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .month-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .nav-btn, .today-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-primary);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 13px;
  }

  .nav-btn:hover, .today-btn:hover {
    background: var(--bg-hover);
  }

  .cal-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  .cal-grid-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .cal-days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-cell {
    aspect-ratio: 1;
    border: 1px solid transparent;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    position: relative;
    padding: 4px;
    transition: background 0.1s;
  }

  .day-cell:hover {
    background: var(--bg-hover);
  }

  .day-cell.other-month {
    opacity: 0.3;
    pointer-events: none;
  }

  .day-cell.is-today {
    border-color: var(--accent-primary);
    font-weight: 700;
  }

  .day-cell.is-selected {
    background: var(--accent-surface);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .event-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent-primary);
    position: absolute;
    bottom: 4px;
  }

  .events-pane {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .events-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .events-list {
    max-height: 100px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .no-events {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .event-bullet {
    color: var(--accent-primary);
  }

  .event-text {
    flex: 1;
  }

  .del-ev-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
  }

  .del-ev-btn:hover {
    color: #ef4444;
  }

  .event-add-form {
    display: flex;
    gap: 8px;
  }

  .event-input {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
  }

  .event-input:focus {
    border-color: var(--accent-primary);
  }

  .add-btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent-primary);
    color: #fff;
    cursor: pointer;
    font-size: 12px;
  }
</style>
