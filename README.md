# Chainkeep — Habit Tracker

## Run the backend
```
cd backend
node server.js
```
Server starts at `http://localhost:5000`. No `npm install` needed — pure Node.js core modules only. Data is saved to `backend/data/habits.json`.

## Run the frontend
Open `frontend/index.html` in the browser (or use a Live Server extension). It talks to the backend at `http://localhost:5000/api`. Make sure the backend is running first.

## Features
- **Two habit types**: Yes/No (boolean) habits and Counter habits (e.g. "drink 8 glasses of water")
- **Categories**: tag habits (Health, Study, Fitness, etc.) with free-text + suggestions
- **Streaks**: current streak and all-time best streak, computed server-side, aware of daily vs weekly frequency
- **Notes per day**: click any day to log a note along with completion/count
- **Dashboard**: total habits, today's completion rate, best streak overall, category count, and a 7-day completion bar chart
- **Full calendar heatmap**: expand any habit to a month view with prev/next navigation
- **Search / filter / sort**: search by name/description, filter by category, sort by name/newest/current streak/best streak
- **Dark / Light theme toggle**: preference saved in the browser

## API endpoints
| Method | Path                     | Body                                                        |
|--------|--------------------------|---------------------------------------------------------------|
| GET    | /api/habits              | —                                                               |
| POST   | /api/habits              | `{ name, description, category, type, targetCount, unit, frequency, color }` |
| PUT    | /api/habits/:id          | same fields, all optional (partial update)                    |
| DELETE | /api/habits/:id          | —                                                               |
| PATCH  | /api/habits/:id/log      | `{ date: "YYYY-MM-DD", done?, count?, note? }`                 |

`type` is `"boolean"` or `"counter"`. For counter habits, a day counts as complete once `count >= targetCount`. `currentStreak` and `bestStreak` are computed server-side on every read, based on `frequency` (daily = consecutive days, weekly = consecutive ISO weeks).
