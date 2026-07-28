# Chainkeep — Habit Tracker

A simple habit tracker: Node/Express/MongoDB backend + a plain HTML/CSS/JS frontend.

## Project structure

```
habit-tracker/
├── backend/
│   ├── controllers/habitController.js   # request handlers
│   ├── routes/habitRoutes.js             # /api/habits routes
│   ├── models/Habit.js                   # Mongoose schema + streak logic
│   ├── config/db.js                      # MongoDB connection
│   ├── middleware/errorHandler.js        # centralized error handling
│   ├── server.js                         # app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## 1. Backend setup

You'll need Node.js and a running MongoDB instance (local, or a free Atlas cluster).

```bash
cd backend
npm install
cp .env.example .env      # then edit MONGO_URI if needed
npm run dev                # or: npm start
```

The API runs at `http://localhost:5000`. Check it's alive:

```bash
curl http://localhost:5000/api/health
```

### API endpoints

| Method | Path                    | Description                          |
|--------|-------------------------|---------------------------------------|
| GET    | /api/habits             | List all habits                       |
| POST   | /api/habits             | Create a habit `{ name, description, color, frequency }` |
| GET    | /api/habits/:id         | Get one habit                         |
| PUT    | /api/habits/:id         | Update a habit                        |
| DELETE | /api/habits/:id         | Delete a habit                        |
| PATCH  | /api/habits/:id/toggle  | Toggle completion for a day `{ date: "YYYY-MM-DD" }` |
| GET    | /api/habits/:id/stats   | Streak + completion-rate stats        |

## 2. Frontend setup

The frontend is plain static files — no build step. Two easy ways to run it:

**Option A — VS Code Live Server / any static server**
Open `frontend/index.html` with a "Live Server" style extension so it's served over `http://127.0.0.1:5500` (matches the default `CLIENT_ORIGIN` in `.env.example`).

**Option B — quick Python server**
```bash
cd frontend
python3 -m http.server 5500
```
Then visit `http://127.0.0.1:5500`.

If you serve the frontend from a different port, update `CLIENT_ORIGIN` in the backend `.env` to match (for CORS), and update `API_BASE` at the top of `frontend/script.js` if the backend isn't on `localhost:5000`.

## Notes

- Each habit stores its completed days as `YYYY-MM-DD` strings, so streaks aren't affected by timezones or server restarts.
- The "chain" row on each habit card shows the last 14 days — click a circle to mark/unmark that day complete.
- Streak calculation lives in `models/Habit.js` as a virtual (`habit.currentStreak`), computed from the completions array.