# FA Music Institute - Management System

## Quick Start

### 1. Setup Database
Make sure you have PostgreSQL running locally.

```bash
cd server
cp .env.example .env
# Edit .env and fill in your database credentials
```

### 2. Run Database Migration
```bash
cd server
npx prisma migrate dev --name init
```

### 3. Start Backend
```bash
cd server
npm run dev
# Server runs at http://localhost:3001
```

### 4. Start Frontend
```bash
cd client
npm run dev
# App runs at http://localhost:5173
```

---

## Features
- **Students** — Full CRUD, instrument tracking, lesson package progress
- **Teachers** — Full CRUD, cost per lesson tracking
- **Schedule Builder** — Drag & drop students into 3 rooms, attendance toggle, copy last week, break slots
- **Export** — Download a clean PNG schedule image ready for WhatsApp

## Tech Stack
- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React (Vite) + dnd-kit + html2canvas + Axios

## Environment Variables
Copy `server/.env.example` to `server/.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/fa_music?schema=public"
PORT=3001
```
