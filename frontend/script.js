const API_BASE = 'http://localhost:5000/api';
const CHAIN_LENGTH = 14; // how many days of the chain to show per habit

const habitListEl = document.getElementById('habitList');
const emptyStateEl = document.getElementById('emptyState');
const modalEl = document.getElementById('habitModal');
const formEl = document.getElementById('habitForm');
const modalTitleEl = document.getElementById('modalTitle');
const cardTemplate = document.getElementById('habitCardTemplate');

const nameInput = document.getElementById('habitName');
const descInput = document.getElementById('habitDescription');
const freqInput = document.getElementById('habitFrequency');
const colorInput = document.getElementById('habitColor');
const idInput = document.getElementById('habitId');

let habits = [];

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
  toggle: (id, date) => apiRequest(`/habits/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ date }) }),
};

// ---------- Date helpers ----------
function toDateKey(d) {
  return d.toISOString().slice(0, 10);
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

// ---------- Rendering ----------
function renderHabits() {
  habitListEl.innerHTML = '';
  emptyStateEl.classList.toggle('hidden', habits.length > 0);

  habits.forEach((habit) => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.habit-card');

    card.dataset.id = habit._id;
    node.querySelector('.link-dot').style.background = habit.color || '#d9a441';
    node.querySelector('.habit-name').textContent = habit.name;

    const descEl = node.querySelector('.habit-description');
    descEl.textContent = habit.description || '';
    descEl.classList.toggle('hidden', !habit.description);

    // Chain row: last CHAIN_LENGTH days as clickable circles
    const chainRow = node.querySelector('.chain-row');
    const completedSet = new Set(habit.completions);
    const today = toDateKey(new Date());

    lastNDays(CHAIN_LENGTH).forEach((day) => {
      const key = toDateKey(day);
      const wrapper = document.createElement('div');
      wrapper.className = 'chain-day';

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'chain-link' + (completedSet.has(key) ? ' done' : '') + (key === today ? ' today' : '');
      link.textContent = completedSet.has(key) ? '✓' : '';
      link.title = key;
      link.addEventListener('click', () => handleToggle(habit._id, key));

      const label = document.createElement('span');
      label.className = 'chain-day-label';
      label.textContent = day.toLocaleDateString(undefined, { weekday: 'narrow' });

      wrapper.appendChild(link);
      wrapper.appendChild(label);
      chainRow.appendChild(wrapper);
    });

    // Footer stats
    node.querySelector('.streak-number').textContent = habit.currentStreak ?? 0;
    const totalDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000) + 1
    );
    const rate = Math.round((habit.completions.length / totalDays) * 100);
    node.querySelector('.rate-number').textContent = `${rate}%`;

    node.querySelector('.edit-btn').addEventListener('click', () => openModal(habit));
    node.querySelector('.delete-btn').addEventListener('click', () => handleDelete(habit._id));

    habitListEl.appendChild(node);
  });
}

// ---------- Data loading ----------
async function loadHabits() {
  try {
    habits = await api.list();
    renderHabits();
  } catch (err) {
    alert(`Couldn't load habits: ${err.message}`);
  }
}

// ---------- Actions ----------
async function handleToggle(id, date) {
  try {
    const updated = await api.toggle(id, date);
    habits = habits.map((h) => (h._id === id ? updated : h));
    renderHabits();
  } catch (err) {
    alert(`Couldn't update that day: ${err.message}`);
  }
}

async function handleDelete(id) {
  if (!confirm('Delete this habit? This cannot be undone.')) return;
  try {
    await api.remove(id);
    habits = habits.filter((h) => h._id !== id);
    renderHabits();
  } catch (err) {
    alert(`Couldn't delete habit: ${err.message}`);
  }
}

// ---------- Modal ----------
function openModal(habit = null) {
  formEl.reset();
  if (habit) {
    modalTitleEl.textContent = 'Edit habit';
    idInput.value = habit._id;
    nameInput.value = habit.name;
    descInput.value = habit.description || '';
    freqInput.value = habit.frequency;
    colorInput.value = habit.color || '#d9a441';
  } else {
    modalTitleEl.textContent = 'New habit';
    idInput.value = '';
    colorInput.value = '#d9a441';
  }
  modalEl.classList.remove('hidden');
  nameInput.focus();
}

function closeModal() {
  modalEl.classList.add('hidden');
}

document.getElementById('newHabitBtn').addEventListener('click', () => openModal());
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) closeModal();
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: nameInput.value.trim(),
    description: descInput.value.trim(),
    frequency: freqInput.value,
    color: colorInput.value,
  };

  try {
    if (idInput.value) {
      const updated = await api.update(idInput.value, payload);
      habits = habits.map((h) => (h._id === updated._id ? updated : h));
    } else {
      const created = await api.create(payload);
      habits.push(created);
    }
    renderHabits();
    closeModal();
  } catch (err) {
    alert(`Couldn't save habit: ${err.message}`);
  }
});

// ---------- Init ----------
loadHabits();
