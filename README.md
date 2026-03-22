# TripMind v2 — AI Travel Companion

> An always-on multilingual AI travel companion that reads your Gmail, listens to your voice in any language, predicts your needs before you feel them, and optimizes every minute of your trip.

---

## Project Structure

```
tripmind/
├── backend/          ← FastAPI (Python)
│   ├── main.py
│   ├── routers/      ← auth, gmail, calendar, suggestions, voice, itinerary, alerts, preferences, analytics, trips
│   ├── services/     ← llm, weather, foursquare, crowd, safety, scheduler, currency, flights
│   ├── models/       ← database.py (SQLAlchemy), schemas.py (Pydantic)
│   ├── utils/        ← config.py (all env vars)
│   ├── requirements.txt
│   ├── railway.toml
│   └── .env.example
│
└── frontend/         ← React + Vite PWA
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── pages/    ← HomePage, TripsPage, ExplorePage, ItineraryPage, ChatPage, AnalyticsPage, SettingsPage
    │   ├── components/ ← Layout, VoiceModal, AlertsPanel, UI
    │   ├── hooks/    ← useLocation, useWeather, useCalendar, useAlerts, useVoice, useTrips
    │   ├── store/    ← Zustand global store
    │   ├── services/ ← api.js (all API calls)
    │   └── styles/   ← globals.css
    ├── package.json
    ├── vite.config.js
    ├── vercel.json
    └── .env.example
```

---

## Quick Start (Local Development)

### Step 1 — Google Cloud Console Setup

1. Go to https://console.cloud.google.com
2. Create a new project called "TripMind"
3. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google+ API (for profile)
4. Go to **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:8000/api/auth/callback`
5. Copy your **Client ID** and **Client Secret**
6. Go to **OAuth consent screen** → Add your email as a test user

### Step 2 — Get API Keys (all free tiers)

| Service | Where | Required? |
|---------|-------|-----------|
| **Groq** (LLM) | console.groq.com | ✅ YES |
| **Google OAuth** | console.cloud.google.com | ✅ YES |
| Foursquare Places | developer.foursquare.com | Optional |
| Google Maps | console.cloud.google.com | Optional |
| AviationStack | aviationstack.com | Optional |
| Twilio (WhatsApp) | twilio.com | Optional |
| Supabase (DB) | supabase.com | Optional |

> **Minimum to run:** Only Groq API key + Google OAuth credentials are required. Everything else degrades gracefully.

### Step 3 — Backend Setup

```bash
cd tripmind/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env and fill in your keys (at minimum: GROQ_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

# Run the server
uvicorn main:app --reload --port 8000
```

Backend will be running at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Step 4 — Frontend Setup

```bash
cd tripmind/frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env:
# VITE_API_URL=http://localhost:8000
# VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Run dev server
npm run dev
```

Frontend will be running at: http://localhost:5173

### Step 5 — First Login

1. Open http://localhost:5173
2. Click "Continue with Google"
3. Sign in with your Google account
4. Grant Gmail (read-only) + Calendar (read-only) permissions
5. You'll be redirected back to TripMind with your dashboard loaded

---

## Manual Deployment

### Backend — Any VPS / Server

```bash
# On your server (Ubuntu/Debian):
git clone <your-repo>
cd tripmind/backend

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with your production values
cp .env.example .env
nano .env   # fill in all values

# Run with uvicorn (production)
uvicorn main:app --host 0.0.0.0 --port 8000

# Or with gunicorn for production:
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Using systemd (recommended for production):**

```ini
# /etc/systemd/system/tripmind.service
[Unit]
Description=TripMind API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/tripmind/backend
Environment="PATH=/home/ubuntu/tripmind/backend/venv/bin"
ExecStart=/home/ubuntu/tripmind/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable tripmind
sudo systemctl start tripmind
```

**With Nginx reverse proxy:**

```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Frontend — Any Static Host

```bash
cd tripmind/frontend

# Create production .env
echo "VITE_API_URL=https://your-api-domain.com" > .env
echo "VITE_GOOGLE_CLIENT_ID=your-client-id" >> .env

# Build
npm run build

# The dist/ folder contains your static site
# Upload dist/ to any static host:
# - Netlify: drag-and-drop dist/ folder
# - Vercel: vercel deploy
# - GitHub Pages: copy dist/ to gh-pages branch
# - Nginx: serve from /var/www/html/
# - Cloudflare Pages: connect repo
```

**Nginx for frontend:**

```nginx
server {
    listen 80;
    server_name your-app-domain.com;
    root /var/www/tripmind;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Update Google OAuth Redirect URI

After deploying, go back to Google Cloud Console and add your production URL:
- Authorized redirect URI: `https://your-api-domain.com/api/auth/callback`
- Authorized JavaScript origins: `https://your-app-domain.com`

Also update in `.env`:
```
FRONTEND_URL=https://your-app-domain.com
GOOGLE_REDIRECT_URI=https://your-api-domain.com/api/auth/callback
```

---

## Railway Deployment (One-click Backend)

1. Push backend to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo, set root directory to `backend/`
4. Add all environment variables from `.env.example`
5. Railway auto-detects `railway.toml` and deploys

---

## Supabase Database Setup (Optional — for persistence)

Without Supabase, TripMind works fully but data resets on server restart.

1. Create project at supabase.com (free tier)
2. Go to Settings → Database → Connection string
3. Add to `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
```
4. Run migrations:
```bash
# From backend/
alembic init alembic
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## Features Implemented

### Module 1 — Context Engine
- ✅ Gmail Deep Parser (flights, hotels, cabs, visas, payments)
- ✅ Google Calendar Sync (free time detection)
- ✅ Real-time GPS tracking
- ✅ Weather Intelligence (Open-Meteo, no key needed)
- ✅ User Preference Profiles
- ✅ Travel Persona Modes (Leisure / Business / Adventure / Family)

### Module 2 — Multilingual & Voice
- ✅ Code-switching support (Hindi+English mixed)
- ✅ Dialect detection (Hindi, Tamil, Telugu, Malayalam, Arabic, Kannada)
- ✅ 99-language voice via Whisper large-v3 on Groq
- ✅ Multilingual output (replies in detected language)
- ✅ Browser fallback STT (WebSpeech API)
- ✅ Browser TTS (Web Speech Synthesis)
- ✅ Vibe-based search ("koi chill jagah batao")

### Module 3 — Proactive Push Intelligence
- ✅ Free time trigger
- ✅ Weather change trigger (rain/heat)
- ✅ Meal time trigger (12pm / 7pm)
- ✅ Hotel check-in trigger
- ✅ Currency rate trigger
- ✅ Crowd prediction trigger
- ✅ Background scheduler (APScheduler)

### Module 4 — Smart Recommendations
- ✅ 6-factor contextual ranking
- ✅ Hidden gem mode
- ✅ Group trip mode
- ✅ Safety alerts
- ✅ Local etiquette push

### Module 5 — Itinerary
- ✅ Auto-itinerary builder
- ✅ Gap filler
- ✅ Live rebalancing (flight delay / meeting overrun)
- ✅ Budget tracker from Gmail emails

### Module 6 — Privacy
- ✅ Read-only Gmail scope
- ✅ Read-only Calendar scope
- ✅ Data vault dashboard (Settings page)
- ✅ No emails ever sent, deleted, or modified

### Module 7 — Feedback & Learning
- ✅ Thumbs up/down on every suggestion
- ✅ Preference extraction from chat
- ✅ Liked/disliked type tracking

### Module 8 — Analytics
- ✅ Trip intelligence dashboard
- ✅ Weekly travel digest
- ✅ Acceptance rate tracking

---

## Environment Variables Reference

See `backend/.env.example` for all variables with descriptions.

**Minimum required:**
```
GROQ_API_KEY=gsk_...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:5173
```

---

## Tech Stack

| Layer | Tool |
|-------|------|
| LLM | Groq + Llama 3.3 70B (free tier) |
| Fallback LLM | Anthropic Claude Haiku |
| STT | Whisper large-v3 via Groq |
| Backend | FastAPI + Python |
| Frontend | React + Vite PWA |
| State | Zustand |
| Weather | Open-Meteo (free, no key) |
| Places | Foursquare Places API |
| Currency | open.er-api.com (free) |
| Auth | Google OAuth 2.0 |
| DB | Supabase / PostgreSQL (optional) |
| Scheduler | APScheduler |
| Notifications | Twilio WhatsApp (optional) |
