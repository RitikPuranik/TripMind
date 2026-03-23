"""
Smart Recommendation Engine.
Pipeline: Foursquare (real data) → Groq (ranking + context) → Response
Falls back to Groq-only if no Foursquare key.
"""
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user
from services.foursquare import search_places
from services.llm import llm_rank_and_describe, llm_generate_suggestions_fallback, _fsq_to_suggestions_fallback, extract_json, call_groq
from services.crowd import predict_crowd
from models.schemas import SuggestionRequest, SuggestionOut
from typing import List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_out(s: dict, req: SuggestionRequest) -> SuggestionOut:
    """Safely convert raw suggestion dict to SuggestionOut."""
    return SuggestionOut(
        id=str(s.get("id") or s.get("fsq_id") or str(s.get("name","place")).lower().replace(" ","_"))[:60],
        name=s.get("name", "Place"),
        place_type=str(s.get("place_type", "place")).lower()[:30],
        emoji=s.get("emoji", "📍"),
        address=s.get("address") or req.city or "Nearby",
        lat=float(s.get("lat", req.lat)),
        lng=float(s.get("lng", req.lng)),
        distance_text=s.get("distance_text", "Nearby"),
        duration_text=s.get("duration_text", "~60 mins"),
        budget_text=s.get("budget_text", "₹200-500 per head"),
        crowd_level=s.get("crowd_level", "medium"),
        crowd_prediction=s.get("crowd_prediction", "Moderate crowds expected"),
        weather_ok=bool(s.get("weather_ok", True)),
        score=float(s.get("score", 0.7)),
        reason=s.get("reason") or f"Well-rated place in {req.city or 'your area'}",
        hidden_gem=bool(s.get("hidden_gem", False)),
        safety_ok=True,
        etiquette_tip=s.get("etiquette_tip"),
    )


@router.post("/", response_model=List[SuggestionOut])
async def get_suggestions(
    req: SuggestionRequest,
    current_user: dict = Depends(get_current_user),
):
    city = req.city or f"{req.lat:.2f},{req.lng:.2f}"
    query = req.vibe or "popular places cafes restaurants"
    suggestions_raw = []

    # ── Step 1: Foursquare real-time data ─────────────────────────────────────
    from utils.config import settings
    if settings.FOURSQUARE_API_KEY:
        logger.info(f"Fetching from Foursquare: '{query}' in {city}")
        fsq_places = await search_places(
            query=query,
            lat=req.lat,
            lng=req.lng,
            city=city,
            radius=5000,
            limit=12,
        )

        if fsq_places:
            logger.info(f"Foursquare returned {len(fsq_places)} places")
            # ── Step 2: Groq ranks + describes real places ─────────────────
            suggestions_raw = await llm_rank_and_describe(
                fsq_places=fsq_places,
                query=query,
                city=city,
                weather_code=req.weather_code or 0,
                temperature=req.temperature or 28.0,
                budget_level=req.budget_level,
                dietary=req.dietary,
                free_minutes=req.free_minutes,
            )
            if not suggestions_raw:
                # LLM ranking failed — use raw Foursquare data directly
                suggestions_raw = _fsq_to_suggestions_fallback(fsq_places, city)
        else:
            logger.warning(f"Foursquare returned 0 results for '{query}' in {city}")

    # ── Step 3: Fallback — Groq-only if no Foursquare key or no results ──────
    if not suggestions_raw:
        logger.info("Using Groq-only fallback")
        suggestions_raw = await llm_generate_suggestions_fallback(
            city=city, lat=req.lat, lng=req.lng,
            free_minutes=req.free_minutes,
            weather_code=req.weather_code or 0,
            temperature=req.temperature or 28.0,
            budget_level=req.budget_level,
            dietary=req.dietary,
            interests=req.interests or [],
            vibe=req.vibe,
            hidden_gems_only=req.hidden_gems_only,
        )

    # ── Step 4: Convert to response model ────────────────────────────────────
    result = []
    for s in suggestions_raw[:6]:
        try:
            result.append(_to_out(s, req))
        except Exception as e:
            logger.warning(f"Skipping malformed suggestion: {e}")
            continue

    result.sort(key=lambda x: x.score, reverse=True)
    return result


@router.post("/feedback")
async def submit_feedback(
    suggestion_id: str,
    vote: str,
    current_user: dict = Depends(get_current_user),
):
    if vote not in ("up", "down"):
        raise HTTPException(400, "vote must be 'up' or 'down'")
    return {"status": "recorded", "suggestion_id": suggestion_id, "vote": vote}


@router.get("/etiquette/{city}")
async def get_etiquette(city: str, current_user: dict = Depends(get_current_user)):
    system = "Give 3 practical etiquette tips for travelers in this city. Return ONLY a JSON array of 3 short strings."
    try:
        reply = await call_groq([{"role": "user", "content": f"Etiquette tips for {city}"}], system, 300, json_mode=True)
        tips = extract_json(reply)
        return {"city": city, "tips": tips or []}
    except Exception:
        return {"city": city, "tips": []}


@router.get("/test-llm")
async def test_llm(current_user: dict = Depends(get_current_user)):
    """Quick health check — verifies Groq + Foursquare connectivity."""
    from utils.config import settings
    result = {
        "groq_key":       bool(settings.GROQ_API_KEY),
        "foursquare_key": bool(settings.FOURSQUARE_API_KEY),
        "groq_status":    None,
        "fsq_status":     None,
    }
    try:
        reply = await call_groq([{"role": "user", "content": "Say hello."}], "", 30)
        result["groq_status"] = "OK"
        result["groq_response"] = reply[:80]
    except Exception as e:
        result["groq_status"] = f"FAIL: {e}"

    if settings.FOURSQUARE_API_KEY:
        try:
            places = await search_places("cafe", 23.2599, 77.4126, "Bhopal", limit=2)
            result["fsq_status"] = f"OK — got {len(places)} places"
        except Exception as e:
            result["fsq_status"] = f"FAIL: {e}"
    else:
        result["fsq_status"] = "No key set"

    return result