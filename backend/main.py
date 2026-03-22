"""TripMind v2 — FastAPI Backend"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from routers import auth, gmail, calendar, suggestions, voice, itinerary, alerts, preferences, analytics, trips, test
from services.scheduler import start_scheduler, stop_scheduler
from utils.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("TripMind v2 starting...")
    await start_scheduler()
    yield
    await stop_scheduler()

app = FastAPI(title="TripMind API", version="2.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router,        prefix="/api/auth",        tags=["auth"])
app.include_router(gmail.router,       prefix="/api/gmail",       tags=["gmail"])
app.include_router(calendar.router,    prefix="/api/calendar",    tags=["calendar"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["suggestions"])
app.include_router(voice.router,       prefix="/api/voice",       tags=["voice"])
app.include_router(itinerary.router,   prefix="/api/itinerary",   tags=["itinerary"])
app.include_router(alerts.router,      prefix="/api/alerts",      tags=["alerts"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])
app.include_router(analytics.router,   prefix="/api/analytics",   tags=["analytics"])
app.include_router(trips.router,       prefix="/api/trips",       tags=["trips"])
app.include_router(test.router,        prefix="/api/test",        tags=["test"])

@app.get("/")
async def root():
    return {"status": "TripMind API v2 running", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}
