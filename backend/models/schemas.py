"""Pydantic v2 schemas for API request/response."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
import uuid


# ── Auth ──────────────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]


# ── User / Preferences ────────────────────────────────────────────────────────
class PreferenceUpdate(BaseModel):
    budget_level: Optional[str] = None
    dietary: Optional[str] = None
    interests: Optional[List[str]] = None
    trip_purpose: Optional[str] = None
    language: Optional[str] = None
    notification_freq: Optional[str] = None
    travel_mode: Optional[str] = None
    home_city: Optional[str] = None
    whatsapp_number: Optional[str] = None


class PreferenceOut(PreferenceUpdate):
    user_id: str
    updated_at: Optional[datetime]


# ── Trips ─────────────────────────────────────────────────────────────────────
class TripCreate(BaseModel):
    destination: str
    city: Optional[str] = None
    country: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    trip_type: str = "general"
    budget_total: float = 0
    currency: str = "INR"

class TripOut(TripCreate):
    id: str
    status: str
    budget_spent: float
    source: str
    itinerary: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Expenses ──────────────────────────────────────────────────────────────────
class ExpenseCreate(BaseModel):
    trip_id: str
    amount: float
    currency: str = "INR"
    category: str
    description: Optional[str] = None
    date: Optional[datetime] = None


# ── Suggestions ───────────────────────────────────────────────────────────────
class SuggestionRequest(BaseModel):
    lat: float
    lng: float
    city: str = ""
    free_minutes: int = 120
    weather_code: Optional[int] = None
    temperature: Optional[float] = None
    budget_level: str = "mid-range"
    dietary: str = "no restrictions"
    interests: List[str] = []
    vibe: Optional[str] = None          # free-form vibe query
    group_profiles: Optional[List[dict]] = None  # Group trip mode
    hidden_gems_only: bool = False


class SuggestionOut(BaseModel):
    id: str
    name: str
    place_type: str
    emoji: str
    address: str
    lat: float
    lng: float
    distance_text: str
    duration_text: str
    budget_text: str
    crowd_level: str
    crowd_prediction: str   # "Quiet until 7pm, then busy"
    weather_ok: bool
    score: float
    reason: str
    hidden_gem: bool = False
    safety_ok: bool = True
    etiquette_tip: Optional[str] = None


# ── Voice ─────────────────────────────────────────────────────────────────────
class VoiceRequest(BaseModel):
    transcript: str
    detected_language: str = "en"
    lat: Optional[float] = None
    lng: Optional[float] = None
    context: Optional[dict] = None     # calendar/weather/trip context


class VoiceResponse(BaseModel):
    reply: str
    reply_language: str
    suggestions: Optional[List[SuggestionOut]] = None
    action: Optional[str] = None       # "navigate" | "book" | "suggest" etc.


# ── Itinerary ─────────────────────────────────────────────────────────────────
class ItineraryDay(BaseModel):
    date: str
    items: List[dict]   # {time, activity, location, duration, notes}

class ItineraryOut(BaseModel):
    trip_id: str
    destination: str
    days: List[ItineraryDay]
    generated_at: datetime
    gaps_filled: int
    meetings_respected: int


# ── Alerts ────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: str
    alert_type: str
    title: str
    body: str
    icon: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Analytics ─────────────────────────────────────────────────────────────────
class TripAnalytics(BaseModel):
    trip_id: str
    destination: str
    total_spent: float
    budget_remaining: float
    suggestions_shown: int
    suggestions_accepted: int
    acceptance_rate: float
    time_optimized_hours: float
    places_visited: List[str]
    top_categories: List[str]
    languages_used: List[str]


# ── Gmail parse result ────────────────────────────────────────────────────────
class ParsedEmail(BaseModel):
    message_id: str
    subject: str
    email_type: str   # flight / hotel / cab / payment / visa / general
    destination: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    amount: Optional[float]
    currency: Optional[str]
    confirmation_number: Optional[str]
    raw_summary: str
