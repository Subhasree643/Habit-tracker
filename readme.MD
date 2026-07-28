Chainkeep is a habit tracker with a Node/Express/MongoDB backend and a plain HTML/CSS/JS frontend.

Run backend:

cd backend && npm install && cp .env.example .env && npm run dev

Runs at http://localhost:5000.

Run frontend:

cd frontend && python3 -m http.server 5500

Open http://127.0.0.1:5500.

Needs a MongoDB instance (local or Atlas) — set its URL in backend/.env.