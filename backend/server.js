// Chainkeep backend — pure Node.js (no Express, no external packages)
// Run with: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5000;
const DATA_FILE = path.join(__dirname, 'data', 'habits.json');

// ---------- Storage helpers ----------
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readHabits() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHabits(habits) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(habits, null, 2), 'utf-8');
}

// ---------- Date helpers ----------
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  return Math.round((d1 - d2) / 86400000);
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing dateStr — used to dedupe weekly completions
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

// ---------- Habit logic ----------
function isDone(entry, habit) {
  if (!entry) return false;
  if (habit.type === 'counter') {
    return (entry.count || 0) >= (habit.targetCount || 1);
  }
  return !!entry.done;
}

// Computes currentStreak, bestStreak, totalCompletions from the logs map.
function computeStats(habit) {
  const logs = habit.logs || {};
  const step = habit.frequency === 'weekly' ? 7 : 1;

  let doneKeys = Object.keys(logs).filter((date) => isDone(logs[date], habit));
  if (habit.frequency === 'weekly') {
    doneKeys = Array.from(new Set(doneKeys.map(mondayOf)));
  }
  doneKeys.sort();

  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of doneKeys) {
    if (prev !== null && daysBetween(d, prev) === step) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }

  const doneSet = new Set(doneKeys);
  let anchor = habit.frequency === 'weekly' ? mondayOf(todayKey()) : todayKey();
  if (!doneSet.has(anchor)) {
    anchor = shiftDate(anchor, -step);
  }
  let current = 0;
  let cursor = anchor;
  while (doneSet.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -step);
  }

  return { currentStreak: current, bestStreak: best, totalCompletions: doneKeys.length };
}

function withComputed(habit) {
  return { ...habit, ...computeStats(habit) };
}

// ---------- HTTP helpers ----------
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- Validation ----------
const VALID_TYPES = ['boolean', 'counter'];
const VALID_FREQ = ['daily', 'weekly'];

function validateHabitPayload(payload, { partial = false } = {}) {
  const errors = [];
  if (!partial || payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
      errors.push('name is required');
    }
  }
  if (payload.type !== undefined && !VALID_TYPES.includes(payload.type)) {
    errors.push('type must be "boolean" or "counter"');
  }
  if (payload.frequency !== undefined && !VALID_FREQ.includes(payload.frequency)) {
    errors.push('frequency must be "daily" or "weekly"');
  }
  if (payload.type === 'counter' && payload.targetCount !== undefined) {
    const n = Number(payload.targetCount);
    if (!Number.isFinite(n) || n < 1) errors.push('targetCount must be a positive number');
  }
  return errors;
}

// ---------- Route handlers: habits ----------
async function handleList(req, res) {
  const habits = readHabits().map(withComputed);
  sendJson(res, 200, { success: true, data: habits });
}

async function handleCreate(req, res) {
  const payload = await readBody(req);
  const errors = validateHabitPayload(payload);
  if (errors.length) {
    return sendJson(res, 400, { success: false, message: errors.join(', ') });
  }

  const type = payload.type === 'counter' ? 'counter' : 'boolean';
  const habit = {
    _id: crypto.randomUUID(),
    name: payload.name.trim(),
    description: (payload.description || '').trim(),
    category: (payload.category || 'General').trim() || 'General',
    type,
    targetCount: type === 'counter' ? Math.max(1, Math.round(Number(payload.targetCount) || 1)) : 1,
    unit: (payload.unit || '').trim(),
    frequency: payload.frequency === 'weekly' ? 'weekly' : 'daily',
    color: payload.color || '#d9a441',
    createdAt: new Date().toISOString(),
    logs: {}, // { "YYYY-MM-DD": { done, count, note } }
  };

  const habits = readHabits();
  habits.push(habit);
  writeHabits(habits);

  sendJson(res, 201, { success: true, data: withComputed(habit) });
}

async function handleUpdate(req, res, id) {
  const payload = await readBody(req);
  const errors = validateHabitPayload(payload, { partial: true });
  if (errors.length) {
    return sendJson(res, 400, { success: false, message: errors.join(', ') });
  }

  const habits = readHabits();
  const idx = habits.findIndex((h) => h._id === id);
  if (idx === -1) {
    return sendJson(res, 404, { success: false, message: 'Habit not found' });
  }

  const existing = habits[idx];
  const nextType = payload.type !== undefined ? payload.type : existing.type;
  habits[idx] = {
    ...existing,
    name: payload.name !== undefined ? payload.name.trim() : existing.name,
    description: payload.description !== undefined ? payload.description.trim() : existing.description,
    category: payload.category !== undefined ? (payload.category.trim() || 'General') : existing.category,
    type: nextType,
    targetCount:
      nextType === 'counter'
        ? Math.max(1, Math.round(Number(payload.targetCount ?? existing.targetCount) || 1))
        : 1,
    unit: payload.unit !== undefined ? payload.unit.trim() : existing.unit,
    frequency: payload.frequency !== undefined ? payload.frequency : existing.frequency,
    color: payload.color !== undefined ? payload.color : existing.color,
  };
  writeHabits(habits);

  sendJson(res, 200, { success: true, data: withComputed(habits[idx]) });
}

async function handleDelete(req, res, id) {
  const habits = readHabits();
  const idx = habits.findIndex((h) => h._id === id);
  if (idx === -1) {
    return sendJson(res, 404, { success: false, message: 'Habit not found' });
  }
  const [removed] = habits.splice(idx, 1);
  writeHabits(habits);
  sendJson(res, 200, { success: true, data: removed });
}

// Merge-update a single day's log entry: { date, done?, count?, note? }
async function handleLog(req, res, id) {
  const payload = await readBody(req);
  const date = payload.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return sendJson(res, 400, { success: false, message: 'date (YYYY-MM-DD) is required' });
  }

  const habits = readHabits();
  const idx = habits.findIndex((h) => h._id === id);
  if (idx === -1) {
    return sendJson(res, 404, { success: false, message: 'Habit not found' });
  }

  const habit = habits[idx];
  habit.logs = habit.logs || {};
  const entry = { ...(habit.logs[date] || {}) };

  if (Object.prototype.hasOwnProperty.call(payload, 'done')) {
    entry.done = !!payload.done;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'count')) {
    entry.count = Math.max(0, Math.round(Number(payload.count) || 0));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'note')) {
    entry.note = String(payload.note).slice(0, 500);
  }

  const meaningful = entry.done || (entry.count && entry.count > 0) || (entry.note && entry.note.trim());
  if (meaningful) {
    habit.logs[date] = entry;
  } else {
    delete habit.logs[date];
  }

  habits[idx] = habit;
  writeHabits(habits);

  sendJson(res, 200, { success: true, data: withComputed(habit) });
}

// ---------- Router ----------
const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const parsed = new URL(url, `http://${req.headers.host}`);
  const parts = parsed.pathname.split('/').filter(Boolean); // ['api','habits', id?, 'log'?]

  try {
    if (parts[0] !== 'api' || parts[1] !== 'habits') {
      return sendJson(res, 404, { success: false, message: 'Not found' });
    }

    if (parts.length === 2 && method === 'GET') return await handleList(req, res);
    if (parts.length === 2 && method === 'POST') return await handleCreate(req, res);
    if (parts.length === 3 && method === 'PUT') return await handleUpdate(req, res, parts[2]);
    if (parts.length === 3 && method === 'DELETE') return await handleDelete(req, res, parts[2]);
    if (parts.length === 4 && parts[3] === 'log' && method === 'PATCH') {
      return await handleLog(req, res, parts[2]);
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Chainkeep backend running at http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
