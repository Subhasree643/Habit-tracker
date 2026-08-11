import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api";
const CHAIN_LENGTH = 14;
const DEFAULT_CATEGORIES = ["Health","Study","Fitness","Finance","Mindfulness","Work","General"];

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
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(cursor.getTime() - i * 86400000));
  }
  return days;
}
function entryStatus(entry, habit) {
  if (!entry) return "empty";
  if (habit.type === "counter") {
    const count = entry.count || 0;
    if (count <= 0) return "empty";
    return count >= habit.targetCount ? "done" : "partial";
  }
  return entry.done ? "done" : "empty";
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body.data;
}

const api = {
  list: () => apiRequest("/habits"),
  create: (payload) => apiRequest("/habits", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/habits/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (id) => apiRequest(`/habits/${id}`, { method: "DELETE" }),
  log: (id, payload) => apiRequest(`/habits/${id}/log`, { method: "PATCH", body: JSON.stringify(payload) }),
};

function HabitModal({ open, habit, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "", description: "", category: "General", frequency: "daily",
    type: "boolean", color: "#d9a441", targetCount: 8, unit: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm(habit ? {
      name: habit.name || "",
      description: habit.description || "",
      category: habit.category || "General",
      frequency: habit.frequency || "daily",
      type: habit.type || "boolean",
      color: habit.color || "#d9a441",
      targetCount: habit.targetCount || 8,
      unit: habit.unit || "",
    } : {
      name: "", description: "", category: "General", frequency: "daily",
      type: "boolean", color: "#d9a441", targetCount: 8, unit: "",
    });
  }, [open, habit]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || "General",
      frequency: form.frequency,
      type: form.type,
      color: form.color,
    };
    if (form.type === "counter") {
      payload.targetCount = Number(form.targetCount) || 1;
      payload.unit = form.unit.trim();
    }
    try {
      await (habit ? api.update(habit._id, payload) : api.create(payload));
      onSaved();
    } catch (err) {
      alert(`Couldn't save habit: ${err.message}`);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{habit ? "Edit habit" : "New habit"}</h2>
        <label className="field"><span>Name</span>
          <input value={form.name} onChange={e => set("name", e.target.value)} maxLength="80" placeholder="e.g. Read 10 pages" required />
        </label>
        <label className="field"><span>Description <em>(optional)</em></span>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} maxLength="300" rows="2" placeholder="Any details that keep you honest" />
        </label>
        <div className="field-row">
          <label className="field"><span>Category</span>
            <input value={form.category} onChange={e => set("category", e.target.value)} list="categoryOptions" maxLength="40" placeholder="e.g. Health" />
            <datalist id="categoryOptions">{DEFAULT_CATEGORIES.map(c => <option value={c} key={c} />)}</datalist>
          </label>
          <label className="field"><span>Frequency</span>
            <select value={form.frequency} onChange={e => set("frequency", e.target.value)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field"><span>Type</span>
            <select value={form.type} onChange={e => set("type", e.target.value)}>
              <option value="boolean">Yes / No</option><option value="counter">Counter (e.g. glasses, pages)</option>
            </select>
          </label>
          <label className="field"><span>Color</span>
            <input type="color" value={form.color} onChange={e => set("color", e.target.value)} />
          </label>
        </div>
        {form.type === "counter" && (
          <div className="field-row">
            <label className="field"><span>Daily target</span>
              <input type="number" min="1" step="1" value={form.targetCount} onChange={e => set("targetCount", e.target.value)} />
            </label>
            <label className="field"><span>Unit <em>(optional)</em></span>
              <input value={form.unit} onChange={e => set("unit", e.target.value)} maxLength="20" placeholder="e.g. glasses" />
            </label>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save habit</button>
        </div>
      </form>
    </div>
  );
}

function DayModal({ open, habit, dateKey, onClose, onSaved }) {
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !habit) return;
    const entry = habit.logs?.[dateKey] || {};
    setDone(!!entry.done);
    setCount(entry.count || 0);
    setNote(entry.note || "");
  }, [open, habit, dateKey]);

  if (!open || !habit) return null;
  const isCounter = habit.type === "counter";

  async function submit(e) {
    e.preventDefault();
    const payload = { date: dateKey, note: note.trim() };
    if (isCounter) payload.count = Math.max(0, Number(count) || 0);
    else payload.done = done;
    try {
      await api.log(habit._id, payload);
      onSaved();
    } catch (err) {
      alert(`Couldn't save that day: ${err.message}`);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>Log day</h2>
        <p className="day-modal-date">{new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        {!isCounter && <label className="field day-toggle-field"><span>Completed</span><input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} /></label>}
        {isCounter && <label className="field"><span>Amount <em>(target: {habit.targetCount}{habit.unit ? ` ${habit.unit}` : ""})</em></span>
          <div className="stepper">
            <button type="button" className="stepper-btn" onClick={() => setCount(v => Math.max(0, Number(v)-1))}>−</button>
            <input type="number" min="0" step="1" value={count} onChange={e => setCount(e.target.value)} />
            <button type="button" className="stepper-btn" onClick={() => setCount(v => Number(v)+1)}>+</button>
          </div>
        </label>}
        <label className="field"><span>Note <em>(optional)</em></span>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength="500" rows="3" placeholder="How did it go?" />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}

function HabitCard({ habit, onRefresh, onEdit, onDelete }) {
  const [monthOpen, setMonthOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth());
  const [year, setYear] = useState(now.getUTCFullYear());
  const [dayDate, setDayDate] = useState(null);

  const days = lastNDays(CHAIN_LENGTH);
  const totalDays = Math.max(1, Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000) + 1);
  const rate = Math.round(((habit.totalCompletions || 0) / totalDays) * 100);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const monthDate = new Date(Date.UTC(year, month, 1));
  const firstDay = (monthDate.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return (
    <article className="habit-card">
      <div className="habit-card-top">
        <div className="habit-title-block">
          <span className="link-dot" style={{background: habit.color || "#d9a441"}} />
          <div>
            <h3 className="habit-name">{habit.name}</h3>
            <div className="habit-meta">
              <span className="category-badge">{habit.category || "General"}</span>
              <span className="type-badge">
                {habit.type === "counter" ? `${habit.targetCount}${habit.unit ? ` ${habit.unit}` : ""}/day` : habit.frequency === "weekly" ? "weekly" : "daily"}
              </span>
            </div>
          </div>
        </div>
        <div className="habit-menu">
          <button className="icon-btn" title="Month view" onClick={() => setMonthOpen(v => !v)}>📅</button>
          <button className="icon-btn" title="Edit habit" onClick={() => onEdit(habit)}>✎</button>
          <button className="icon-btn delete-btn" title="Delete habit" onClick={() => onDelete(habit._id)}>✕</button>
        </div>
      </div>

      {habit.description && <p className="habit-description">{habit.description}</p>}

      <div className="chain-row">
        {days.map(day => {
          const key = toDateKey(day);
          const entry = habit.logs?.[key];
          const status = entryStatus(entry, habit);
          return <div className="chain-day" key={key}>
            {entry?.note && <span className="note-dot" />}
            <button type="button" className={`chain-link ${status === "done" ? "done" : status === "partial" ? "partial" : ""} ${key === todayKey() ? "today" : ""}`} title={key} onClick={() => setDayDate(key)}>
              {habit.type === "counter" ? (entry?.count ? String(entry.count) : "") : status === "done" ? "✓" : ""}
            </button>
            <span className="chain-day-label">{day.toLocaleDateString(undefined, {weekday:"narrow"})}</span>
          </div>;
        })}
      </div>

      {monthOpen && <div className="month-view">
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="month-label">{monthDate.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</span>
          <button type="button" className="icon-btn" onClick={() => shiftMonth(1)}>›</button>
        </div>
        <div className="month-grid">
          {Array.from({length:firstDay}).map((_,i)=><div className="month-cell empty" key={`e${i}`} />)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const key = toDateKey(new Date(Date.UTC(year,month,day)));
            const entry = habit.logs?.[key];
            const status = entryStatus(entry, habit);
            const future = key > todayKey();
            return <div key={key} className={`month-cell ${status==="done"?"done":status==="partial"?"partial":""} ${key===todayKey()?"today":""} ${future?"future":""}`} title={key} onClick={() => !future && setDayDate(key)}>{day}</div>;
          })}
        </div>
      </div>}

      <div className="habit-footer">
        <div className="streak-count"><span className="streak-number">{habit.currentStreak ?? 0}</span><span className="streak-label">day streak</span></div>
        <div className="best-count"><span className="best-number">{habit.bestStreak ?? 0}</span><span className="best-label">best streak</span></div>
        <div className="rate-count"><span className="rate-number">{rate}%</span><span className="rate-label">completion</span></div>
      </div>

      <DayModal open={!!dayDate} habit={habit} dateKey={dayDate} onClose={() => setDayDate(null)} onSaved={() => {setDayDate(null); onRefresh();}} />
    </article>
  );
}

export default function App() {
  const [habits, setHabits] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [theme, setTheme] = useState(localStorage.getItem("chainkeep-theme") || "dark");
  const [habitModal, setHabitModal] = useState({open:false, habit:null});
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("chainkeep-theme", theme);
  }, [theme]);

  async function loadHabits() {
    try { setError(""); setHabits(await api.list()); }
    catch (err) { setError(`Couldn't load habits: ${err.message}`); }
  }
  useEffect(() => { loadHabits(); }, []);

  const categories = useMemo(() => [...new Set(habits.map(h => h.category || "General"))].sort(), [habits]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = habits.filter(h => (!q || h.name.toLowerCase().includes(q) || (h.description || "").toLowerCase().includes(q)) && (!category || h.category === category));
    return [...list].sort((a,b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "streak") return (b.currentStreak || 0) - (a.currentStreak || 0);
      if (sort === "best") return (b.bestStreak || 0) - (a.bestStreak || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [habits, search, category, sort]);

  const stats = useMemo(() => {
    const today = todayKey();
    const doneToday = habits.filter(h => entryStatus(h.logs?.[today], h) === "done").length;
    const best = habits.reduce((m,h) => Math.max(m,h.bestStreak || 0), 0);
    return { total: habits.length, today: habits.length ? Math.round(doneToday / habits.length * 100) : 0, best, cats: new Set(habits.map(h => h.category || "General")).size };
  }, [habits]);

  const week = lastNDays(7).map(day => {
    const key = toDateKey(day);
    const done = habits.filter(h => entryStatus(h.logs?.[key], h) === "done").length;
    return { label: day.toLocaleDateString(undefined,{weekday:"narrow"}), pct: habits.length ? Math.round(done / habits.length * 100) : 0 };
  });

  async function remove(id) {
    if (!confirm("Delete this habit? This cannot be undone.")) return;
    try { await api.remove(id); await loadHabits(); }
    catch (err) { alert(`Couldn't delete habit: ${err.message}`); }
  }

  return (
    <div className="wrap">
      <header className="app-header">
        <div className="brand"><span className="brand-mark">⛓</span><div><h1>Chainkeep</h1><p className="tagline">Don't break the chain.</p></div></div>
        <div className="header-actions">
          <button className="icon-btn theme-btn" title="Toggle theme" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>{theme === "light" ? "☀️" : "🌙"}</button>
          <button className="btn btn-primary" onClick={() => setHabitModal({open:true,habit:null})}>+ New habit</button>
        </div>
      </header>

      {error && <div className="empty-state"><h2>Connection error</h2><p>{error}</p><p>Make sure the Node.js backend is running on port 5000.</p></div>}

      {habits.length > 0 && <>
        <section className="dashboard">
          <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Habits</span></div>
          <div className="stat-card"><span className="stat-value">{stats.today}%</span><span className="stat-label">Today's rate</span></div>
          <div className="stat-card"><span className="stat-value">{stats.best}</span><span className="stat-label">Best streak</span></div>
          <div className="stat-card"><span className="stat-value">{stats.cats}</span><span className="stat-label">Categories</span></div>
          <div className="stat-chart-card"><span className="stat-chart-label">Last 7 days</span><div className="week-chart">{week.map((d,i)=><div className="week-bar-wrap" key={i}><div className="week-bar" style={{height:`${Math.max(d.pct,3)}%`}} title={`${d.pct}%`} /><span className="week-bar-label">{d.label}</span></div>)}</div></div>
        </section>

        <section className="toolbar">
          <input className="toolbar-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search habits…" />
          <select className="toolbar-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
          <select className="toolbar-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="name">Name (A–Z)</option><option value="streak">Current streak</option><option value="best">Best streak</option></select>
        </section>
      </>}

      {habits.length === 0 && !error && <section className="empty-state"><p className="empty-glyph">○ ○ ○</p><h2>No habits yet</h2><p>Add one below and start building your first chain.</p></section>}
      {habits.length > 0 && filtered.length === 0 && <section className="empty-state"><p className="empty-glyph">— — —</p><h2>No matches</h2><p>Try a different search or filter.</p></section>}
      <section className="habit-list">{filtered.map(h=><HabitCard key={h._id} habit={h} onRefresh={loadHabits} onEdit={habit=>setHabitModal({open:true,habit})} onDelete={remove} />)}</section>

      <HabitModal open={habitModal.open} habit={habitModal.habit} onClose={()=>setHabitModal({open:false,habit:null})} onSaved={()=>{setHabitModal({open:false,habit:null});loadHabits();}} />
    </div>
  );
}
