"""Central config — all env vars live here."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    FRONTEND_URL: str = "http://localhost:5173"
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"

    # Google OAuth (for Gmail + Calendar)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    # ── LLM — 100% FREE, no credit card ──────────────────────────────────────
    # Option A: Groq (RECOMMENDED) — console.groq.com — Llama 3.3 70B, unlimited free
    GROQ_API_KEY: str = ""
    # Option B: Google Gemini Flash — aistudio.google.com — 1500 free req/day
    GEMINI_API_KEY: str = ""
    # You only need ONE of the two above. Groq is preferred.

    # ── External APIs (all optional, all have free tiers) ─────────────────────
    FOURSQUARE_API_KEY: str = ""     # Places & POI — developer.foursquare.com
    GOOGLE_MAPS_API_KEY: str = ""    # Distance/directions — console.cloud.google.com
    AVIATIONSTACK_API_KEY: str = ""  # Flight status — aviationstack.com (100 free/mo)
    EXCHANGERATE_API_KEY: str = ""   # Currency — open.er-api.com (works without key too)
    EVENTBRITE_API_KEY: str = ""     # Local events — eventbrite.com/platform

    # ── WhatsApp digests (optional) ───────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # ── Database (optional — works without it, data resets on restart) ────────
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    DATABASE_URL: str = ""

    # ── Monitoring (optional) ─────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
