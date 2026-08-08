const API_BASE = 'http://localhost:5000/api';
const CHAIN_LENGTH = 14; // how many days of the chain row to show per habit
const DEFAULT_CATEGORIES = ['Health', 'Study', 'Fitness', 'Finance', 'Mindfulness', 'Work', 'General'];

const habitListEl = document.getElementById('habitList');
const emptyStateEl = document.getElementById('emptyState');
const noResultsEl = document.getElementById('noResults');
const dashboardEl = document.getElementById('dashboard');
const toolbarEl = document.getElementById('toolbar');
const cardTemplate = document.getElementById('habitCardTemplate');

const habitModal = document.getElementById('habitModal');
const habitForm = document.getElementById('habitForm');
const modalTitleEl = document.getElementById('modalTitle');
const nameInput = document.getElementById('habitName');
const descInput = document.getElementById('habitDescription');
const categoryInput = document.getElementById('habitCategory');
const freqInput = document.getElementById('habitFrequency');
const typeInput = document.getElementById('habitType');
const colorInput = document.getElementById('habitColor');
const targetInput = document.getElementById('habitTarget');
const unitInput = document.getElementById('habitUnit');
const idInput = document.getElementById('habitId');
const counterFields = document.getElementById('counterFields');

const dayModal = document.getElementById('dayModal');
const dayForm = document.getElementById('dayForm');
const dayModalDate = document.getElementById('dayModalDate');
const dayDoneInput = document.getElementById('dayDone');
const dayCounterField = document.getElementById('dayCounterField');
const dayCounterUnit = document.getElementById('dayCounterUnit');
const dayCounterValue = document.getElementById('dayCounterValue');
const dayNoteInput = document.getElementById('dayNote');
const dayHabitIdInput = document.getElementById('dayHabitId');
const dayDateInput = document.getElementById('dayDate');

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');
const themeToggleBtn = document.getElementById('themeToggleBtn');

let habits = [];
const monthState = new Map(); // habitId -> { year, month, open }

// ---------- Theme ----------
function initTheme() {
  const saved = localStorage.getItem('chainkeep-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  themeToggleBtn.textContent = saved === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('chainkeep-theme', next);
  themeToggleBtn.textContent = next === 'light' ? '☀️' : '🌙';
}

themeToggleBtn.addEventListener('click', toggleTheme);

// ---------- API helpers ----------
async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body.data;
}

const api = {
  list: () => apiRequest('/habits'),
  create: (payload) => apiRequest('/habits', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/habits/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/habits/${id}`, { method: 'DELETE' }),
  log: (id, payload) => apiRequest(`/habits/${id}/log`, { method: 'PATCH', body: JSON.stringify(payload) }),
};

// ---------- Date helpers ----------
function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return toDateKey(new Date());
}

function lastNDays(n) {
  const days = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    days.push(new Date(cursor.getTime() - i * 86400000));
  }
  return days;
}

// ---------- Habit status helpers ----------
function entryStatus(entry, habit) {
  if (!entry) return 'empty';
  if (habit.type === 'counter') {
    const count = entry.count || 0;
    if (count <= 0) return 'empty';
    return count >= habit.targetCount ? 'done' : 'partial';
  }
  return entry.done ? 'done' : 'empty';
}

// ---------- Dashboard ----------
function renderDashboard() {
  if (habits.length === 0) {
    dashboardEl.classList.add('hidden');
    return;
  }
  dashboardEl.classList.remove('hidden');

  document.getElementById('statTotal').textContent = habits.length;

  const today = todayKey();
  const doneToday = habits.filter((h) => entryStatus(h.logs[today], h) === 'done').length;
  const rate = Math.round((doneToday / habits.length) * 100);
  document.getElementById('statToday').textContent = `${rate}%`;

  const bestOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak || 0), 0);
  document.getElementById('statBest').textContent = bestOverall;

  const categories = new Set(habits.map((h) => h.category || 'General'));
  document.getElementById('statCategories').textContent = categories.size;

  // last 7 days completion rate bar chart
  const weekChart = document.getElementById('weekChart');
  weekChart.innerHTML = '';
  lastNDays(7).forEach((day) => {
    const key = toDateKey(day);
    const done = habits.filter((h) => entryStatus(h.logs[key], h) === 'done').length;
    const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;

    const wrap = document.createElement('div');
    wrap.className = 'week-bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'week-bar';
    bar.style.height = `${Math.max(pct, 3)}%`;
    bar.title = `${pct}%`;

    const label = document.createElement('span');
    label.className = 'week-bar-label';
    label.textContent = day.toLocaleDateString(undefined, { weekday: 'narrow' });

    wrap.appendChild(bar);
    wrap.appendChild(label);
    weekChart.appendChild(wrap);
  });
}

// ---------- Toolbar ----------
function populateCategoryFilter() {
  const existing = new Set(habits.map((h) => h.category || 'General'));
  const current = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  Array.from(existing).sort().forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
  if (existing.has(current)) categoryFilter.value = current;
}

function getFilteredSortedHabits() {
  const search = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const sort = sortSelect.value;

  let list = habits.filter((h) => {
    const matchesSearch =
      !search ||
      h.name.toLowerCase().includes(search) ||
      (h.description || '').toLowerCase().includes(search);
    const matchesCategory = !category || h.category === category;
    return matchesSearch && matchesCategory;
  });

  list = [...list].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'streak') return (b.currentStreak || 0) - (a.currentStreak || 0);
    if (sort === 'best') return (b.bestStreak || 0) - (a.bestStreak || 0);
    return new Date(b.createdAt) - new Date(a.createdAt); // newest
  });

  return list;
}

[searchInput, categoryFilter, sortSelect].forEach((el) => {
  el.addEventListener('input', renderHabits);
  el.addEventListener('change', renderHabits);
});

// ---------- Rendering: habit cards ----------
function renderHabits() {
  toolbarEl.classList.toggle('hidden', habits.length === 0);
  emptyStateEl.classList.toggle('hidden', habits.length > 0);

  const list = habits.length ? getFilteredSortedHabits() : [];
  noResultsEl.classList.toggle('hidden', !(habits.length > 0 && list.length === 0));

  habitListEl.innerHTML = '';

  list.forEach((habit) => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.habit-card');
    card.dataset.id = habit._id;

    node.querySelector('.link-dot').style.background = habit.color || '#d9a441';
    node.querySelector('.habit-name').textContent = habit.name;
    node.querySelector('.category-badge').textContent = habit.category || 'General';

    const typeBadge = node.querySelector('.type-badge');
    typeBadge.textContent =
      habit.type === 'counter'
        ? `${habit.targetCount}${habit.unit ? ' ' + habit.unit : ''}/day`
        : habit.frequency === 'weekly'
        ? 'weekly'
        : 'daily';

    const descEl = node.querySelector('.habit-description');
    descEl.textContent = habit.description || '';
    descEl.classList.toggle('hidden', !habit.description);

    // ----- Chain row (last 14 days) -----
    const chainRow = node.querySelector('.chain-row');
    const today = todayKey();

    lastNDays(CHAIN_LENGTH).forEach((day) => {
      const key = toDateKey(day);
      const entry = habit.logs[key];
      const status = entryStatus(entry, habit);

      const wrapper = document.createElement('div');
      wrapper.className = 'chain-day';

      const link = document.createElement('button');
      link.type = 'button';
      link.className = `chain-link${status === 'done' ? ' done' : status === 'partial' ? ' partial' : ''}${key === today ? ' today' : ''}`;
      link.textContent =
        habit.type === 'counter'
          ? (entry && entry.count ? String(entry.count) : '')
          : status === 'done'
          ? '✓'
          : '';
      link.title = key;
      link.addEventListener('click', () => openDayModal(habit._id, key));

      if (entry && entry.note) {
        const dot = document.createElement('span');
        dot.className = 'note-dot';
        wrapper.appendChild(dot);
      }

      const label = document.createElement('span');
      label.className = 'chain-day-label';
      label.textContent = day.toLocaleDateString(undefined, { weekday: 'narrow' });

      wrapper.appendChild(link);
      wrapper.appendChild(label);
      chainRow.appendChild(wrapper);
    });

    // ----- Month view -----
    const monthBtn = node.querySelector('.month-btn');
    const monthView = node.querySelector('.month-view');
    const monthGrid = node.querySelector('.month-grid');
    const monthLabel = node.querySelector('.month-label');
    const monthPrev = node.querySelector('.month-prev');
    const monthNext = node.querySelector('.month-next');

    if (!monthState.has(habit._id)) {
      const now = new Date();
      monthState.set(habit._id, { year: now.getUTCFullYear(), month: now.getUTCMonth(), open: false });
    }

    monthBtn.addEventListener('click', () => {
      const st = monthState.get(habit._id);
      st.open = !st.open;
      monthView.classList.toggle('hidden', !st.open);
      if (st.open) renderMonthGrid(habit, monthGrid, monthLabel, st);
    });

    monthPrev.addEventListener('click', () => {
      const st = monthState.get(habit._id);
      st.month -= 1;
      if (st.month < 0) { st.month = 11; st.year -= 1; }
      renderMonthGrid(habit, monthGrid, monthLabel, st);
    });

    monthNext.addEventListener('click', () => {
      const st = monthState.get(habit._id);
      st.month += 1;
      if (st.month > 11) { st.month = 0; st.year += 1; }
      renderMonthGrid(habit, monthGrid, monthLabel, st);
    });

    const savedState = monthState.get(habit._id);
    monthView.classList.toggle('hidden', !savedState.open);
    if (savedState.open) renderMonthGrid(habit, monthGrid, monthLabel, savedState);

    // ----- Footer stats -----
    node.querySelector('.streak-number').textContent = habit.currentStreak ?? 0;
    node.querySelector('.best-number').textContent = habit.bestStreak ?? 0;
    const totalDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000) + 1
    );
    const rate = Math.round((habit.totalCompletions / totalDays) * 100);
    node.querySelector('.rate-number').textContent = `${rate}%`;

    node.querySelector('.edit-btn').addEventListener('click', () => openHabitModal(habit));
    node.querySelector('.delete-btn').addEventListener('click', () => handleDelete(habit._id));

    habitListEl.appendChild(node);
  });
}

function renderMonthGrid(habit, gridEl, labelEl, state) {
  const { year, month } = state;
  const monthDate = new Date(Date.UTC(year, month, 1));
  labelEl.textContent = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  gridEl.innerHTML = '';
  const firstDayOfWeek = (monthDate.getUTCDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = todayKey();

  for (let i = 0; i < firstDayOfWeek; i += 1) {
    const filler = document.createElement('div');
    filler.className = 'month-cell empty';
    gridEl.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toDateKey(new Date(Date.UTC(year, month, day)));
    const entry = habit.logs[key];
    const status = entryStatus(entry, habit);
    const isFuture = key > today;

    const cell = document.createElement('div');
    cell.className = `month-cell${status === 'done' ? ' done' : status === 'partial' ? ' partial' : ''}${key === today ? ' today' : ''}${isFuture ? ' future' : ''}`;
    cell.textContent = day;
    cell.title = key;
    if (!isFuture) {
      cell.addEventListener('click', () => openDayModal(habit._id, key));
    }
    gridEl.appendChild(cell);
  }
}

// ---------- Data loading ----------
async function loadHabits() {
  try {
    habits = await api.list();
    populateCategoryFilter();
    renderDashboard();
    renderHabits();
  } catch (err) {
    alert(`Couldn't load habits: ${err.message}`);
  }
}

// ---------- Delete ----------
async function handleDelete(id) {
  if (!confirm('Delete this habit? This cannot be undone.')) return;
  try {
    await api.remove(id);
    habits = habits.filter((h) => h._id !== id);
    monthState.delete(id);
    populateCategoryFilter();
    renderDashboard();
    renderHabits();
  } catch (err) {
    alert(`Couldn't delete habit: ${err.message}`);
  }
}

// ---------- Habit create/edit modal ----------
function updateCounterFieldsVisibility() {
  counterFields.classList.toggle('hidden', typeInput.value !== 'counter');
}

typeInput.addEventListener('change', updateCounterFieldsVisibility);

function openHabitModal(habit = null) {
  habitForm.reset();
  if (habit) {
    modalTitleEl.textContent = 'Edit habit';
    idInput.value = habit._id;
    nameInput.value = habit.name;
    descInput.value = habit.description || '';
    categoryInput.value = habit.category || '';
    freqInput.value = habit.frequency;
    typeInput.value = habit.type;
    colorInput.value = habit.color || '#d9a441';
    targetInput.value = habit.targetCount || 8;
    unitInput.value = habit.unit || '';
  } else {
    modalTitleEl.textContent = 'New habit';
    idInput.value = '';
    colorInput.value = '#d9a441';
    typeInput.value = 'boolean';
    targetInput.value = 8;
  }
  updateCounterFieldsVisibility();
  habitModal.classList.remove('hidden');
  nameInput.focus();
}

function closeHabitModal() {
  habitModal.classList.add('hidden');
}

document.getElementById('newHabitBtn').addEventListener('click', () => openHabitModal());
document.getElementById('cancelBtn').addEventListener('click', closeHabitModal);
habitModal.addEventListener('click', (e) => {
  if (e.target === habitModal) closeHabitModal();
});

habitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: nameInput.value.trim(),
    description: descInput.value.trim(),
    category: categoryInput.value.trim() || 'General',
    frequency: freqInput.value,
    type: typeInput.value,
    color: colorInput.value,
  };
  if (typeInput.value === 'counter') {
    payload.targetCount = Number(targetInput.value) || 1;
    payload.unit = unitInput.value.trim();
  }

  try {
    if (idInput.value) {
      const updated = await api.update(idInput.value, payload);
      habits = habits.map((h) => (h._id === updated._id ? updated : h));
    } else {
      const created = await api.create(payload);
      habits.push(created);
    }
    populateCategoryFilter();
    renderDashboard();
    renderHabits();
    closeHabitModal();
  } catch (err) {
    alert(`Couldn't save habit: ${err.message}`);
  }
});

// ---------- Day detail modal ----------
function openDayModal(habitId, dateKey) {
  const habit = habits.find((h) => h._id === habitId);
  if (!habit) return;
  const entry = habit.logs[dateKey] || {};

  dayHabitIdInput.value = habitId;
  dayDateInput.value = dateKey;
  dayModalDate.textContent = new Date(dateKey + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  dayNoteInput.value = entry.note || '';

  const isCounter = habit.type === 'counter';
  dayCounterField.classList.toggle('hidden', !isCounter);
  document.querySelector('.day-toggle-field').classList.toggle('hidden', isCounter);

  if (isCounter) {
    dayCounterValue.value = entry.count || 0;
    dayCounterUnit.textContent = `(target: ${habit.targetCount}${habit.unit ? ' ' + habit.unit : ''})`;
  } else {
    dayDoneInput.checked = !!entry.done;
  }

  dayModal.classList.remove('hidden');
}

function closeDayModal() {
  dayModal.classList.add('hidden');
}

document.getElementById('dayCancelBtn').addEventListener('click', closeDayModal);
dayModal.addEventListener('click', (e) => {
  if (e.target === dayModal) closeDayModal();
});

document.getElementById('dayCounterMinus').addEventListener('click', () => {
  dayCounterValue.value = Math.max(0, Number(dayCounterValue.value || 0) - 1);
});
document.getElementById('dayCounterPlus').addEventListener('click', () => {
  dayCounterValue.value = Number(dayCounterValue.value || 0) + 1;
});

dayForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const habitId = dayHabitIdInput.value;
  const habit = habits.find((h) => h._id === habitId);
  if (!habit) return;

  const payload = { date: dayDateInput.value, note: dayNoteInput.value.trim() };
  if (habit.type === 'counter') {
    payload.count = Math.max(0, Number(dayCounterValue.value) || 0);
  } else {
    payload.done = dayDoneInput.checked;
  }

  try {
    const updated = await api.log(habitId, payload);
    habits = habits.map((h) => (h._id === updated._id ? updated : h));
    renderDashboard();
    renderHabits();
    closeDayModal();
  } catch (err) {
    alert(`Couldn't save that day: ${err.message}`);
  }
});

// ---------- Init ----------
initTheme();
loadHabits();
