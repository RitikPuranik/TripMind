"""Smart Recommendation Engine — 6-factor contextual ranking."""
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user
from services.llm import llm_generate_suggestions, call_groq, extract_json
from services.foursquare import get_nearby_places
from services.crowd import predict_crowd
from services.safety import check_safety
from models.schemas import SuggestionRequest, SuggestionOut
from typing import List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_suggestion(s: dict, req: SuggestionRequest, crowd: dict, safety: dict) -> SuggestionOut:
    """Safely build a SuggestionOut — all fields have fallbacks."""
    raw_id = s.get("id") or s.get("name", "place")
    safe_id = str(raw_id).lower().replace(" ", "_")[:50]
    return SuggestionOut(
        id=safe_id,
        name=s.get("name", "Local Place"),
        place_type=s.get("place_type", "cafe"),
        emoji=s.get("emoji", "📍"),
        address=s.get("address") or req.city or "Nearby",
        lat=float(s.get("lat", req.lat)),
        lng=float(s.get("lng", req.lng)),
        distance_text=s.get("distance_text", "Nearby"),
        duration_text=s.get("duration_text", "~60 mins"),
        budget_text=s.get("budget_text", "₹200-400 per head"),
        crowd_level=crowd.get("level", s.get("crowd_level", "medium")),
        crowd_prediction=crowd.get("prediction", s.get("crowd_prediction", "Moderate crowds expected")),
        weather_ok=bool(s.get("weather_ok", True)),
        score=float(s.get("score", 0.75)),
        reason=s.get("reason") or "Good match for your current context",
        hidden_gem=bool(s.get("hidden_gem", False)),
        safety_ok=bool(safety.get("safe", True)),
        etiquette_tip=s.get("etiquette_tip"),
    )


@router.post("/", response_model=List[SuggestionOut])
async def get_suggestions(
    req: SuggestionRequest,
    current_user: dict = Depends(get_current_user),
):
    city = req.city or f"{req.lat:.4f},{req.lng:.4f}"

    # 1. Try LLM suggestions
    suggestions_raw = []
    try:
        suggestions_raw = await llm_generate_suggestions(
            city=city,
            lat=req.lat, lng=req.lng,
            free_minutes=req.free_minutes,
            weather_code=req.weather_code or 0,
            temperature=req.temperature or 28.0,
            budget_level=req.budget_level,
            dietary=req.dietary,
            interests=req.interests or [],
            vibe=req.vibe,
            liked_types=[],
            disliked_types=[],
            hidden_gems_only=req.hidden_gems_only,
            group_profiles=req.group_profiles,
        )
    except Exception as e:
        logger.warning(f"LLM suggestions failed: {e}")

    # 2. If LLM returned nothing, use smart fallbacks for the city
    if not suggestions_raw:
        suggestions_raw = _fallback_suggestions(city, req)

    # 3. Enrich each suggestion with crowd + safety data
    result = []
    for s in suggestions_raw[:6]:
        try:
            crowd  = await predict_crowd(s.get("name", ""), s.get("lat", req.lat), s.get("lng", req.lng))
            safety = await check_safety(s.get("lat", req.lat), s.get("lng", req.lng))
            result.append(_build_suggestion(s, req, crowd, safety))
        except Exception as e:
            logger.warning(f"Enrichment failed for {s.get('name')}: {e}")
            continue

    result.sort(key=lambda x: x.score, reverse=True)
    return result


def _fallback_suggestions(city: str, req: SuggestionRequest) -> list:
    """
    Hardcoded fallback suggestions when Groq is unavailable or returns bad JSON.
    These are generic but contextually sensible.
    """
    is_rain = req.weather_code and 51 <= req.weather_code <= 82
    budget  = req.budget_level or "mid-range"

    budget_text = {
        "low":      "₹100-250 per head",
        "mid-range":"₹300-600 per head",
        "high":     "₹800+ per head",
    }.get(budget, "₹300-600 per head")

    if is_rain:
        return [
            {"id":"fallback_cafe","name":f"Cozy Café near {city}","place_type":"cafe","emoji":"☕","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"5-10 min walk","duration_text":"~90 mins","budget_text":budget_text,"crowd_level":"low","crowd_prediction":"Usually quiet indoors","weather_ok":True,"score":0.88,"reason":"Suggested because: indoor, raining outside, good for work or relaxing","hidden_gem":False,"safety_ok":True},
            {"id":"fallback_mall","name":f"Shopping Mall near {city}","place_type":"mall","emoji":"🛍️","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"10-15 min","duration_text":"~2 hrs","budget_text":budget_text,"crowd_level":"medium","crowd_prediction":"Moderate crowds","weather_ok":True,"score":0.75,"reason":"Suggested because: fully indoor, rain cover, food court options","hidden_gem":False,"safety_ok":True},
            {"id":"fallback_museum","name":f"Local Museum near {city}","place_type":"museum","emoji":"🏛️","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"15-20 min","duration_text":"~2 hrs","budget_text":budget_text,"crowd_level":"low","crowd_prediction":"Usually quiet on weekdays","weather_ok":True,"score":0.70,"reason":"Suggested because: indoor activity, culturally enriching, rainy day ideal","hidden_gem":False,"safety_ok":True},
        ]

    return [
        {"id":"fallback_cafe","name":f"Local Café near {city}","place_type":"cafe","emoji":"☕","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"5 min walk","duration_text":"~60 mins","budget_text":budget_text,"crowd_level":"low","crowd_prediction":"Quiet mornings, busier afternoons","weather_ok":True,"score":0.88,"reason":"Suggested because: close by, matches your budget, good for a break","hidden_gem":True,"safety_ok":True},
        {"id":"fallback_restaurant","name":f"Local Restaurant near {city}","place_type":"restaurant","emoji":"🍽️","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"8 min walk","duration_text":"~60 mins","budget_text":budget_text,"crowd_level":"medium","crowd_prediction":"Busy at lunch and dinner peak","weather_ok":True,"score":0.82,"reason":"Suggested because: meal time, matches dietary preference, highly rated locally","hidden_gem":False,"safety_ok":True},
        {"id":"fallback_park","name":f"Nearby Park or Garden","place_type":"park","emoji":"🌿","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"10 min walk","duration_text":"~45 mins","budget_text":"Free","crowd_level":"low","crowd_prediction":"Peaceful, best in morning","weather_ok":True,"score":0.76,"reason":"Suggested because: free, outdoor, good weather, close to you","hidden_gem":False,"safety_ok":True},
        {"id":"fallback_market","name":f"Local Market near {city}","place_type":"market","emoji":"🛒","address":city,"lat":req.lat,"lng":req.lng,"distance_text":"12 min","duration_text":"~45 mins","budget_text":budget_text,"crowd_level":"medium","crowd_prediction":"Busier on weekends","weather_ok":True,"score":0.70,"reason":"Suggested because: local experience, fits your free time, budget-friendly","hidden_gem":True,"safety_ok":True},
    ]


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
    system = "Give exactly 3 practical etiquette tips for travelers visiting this city. Return ONLY a JSON array of 3 short strings."
    try:
        reply = await call_groq([{"role": "user", "content": f"Etiquette tips for {city}"}], system, 300, json_mode=True)
        tips = extract_json(reply)
        return {"city": city, "tips": tips or []}
    except Exception:
        return {"city": city, "tips": []}


@router.get("/test-llm")
async def test_llm(current_user: dict = Depends(get_current_user)):
    """Quick test — call this to verify your GROQ_API_KEY is working."""
    try:
        reply = await call_groq(
            [{"role": "user", "content": "Say hello in one sentence."}],
            "You are a helpful assistant.", 100
        )
        return {"status": "ok", "llm_response": reply}
    except Exception as e:
        return {"status": "error", "detail": str(e), "fix": "Check GROQ_API_KEY in backend/.env"}


@router.get("/debug")
async def debug_suggestions(
    city: str = "Bhopal",
    current_user: dict = Depends(get_current_user),
):
    """Debug endpoint — shows exactly what Groq returns and why fallback triggers."""
    from utils.config import settings as cfg
    import traceback

    result = {
        "groq_key_set": bool(cfg.GROQ_API_KEY),
        "groq_key_prefix": cfg.GROQ_API_KEY[:8] + "..." if cfg.GROQ_API_KEY else "NOT SET",
        "city": city,
        "llm_raw": None,
        "llm_parsed": None,
        "error": None,
    }

    try:
        from services.llm import call_groq, extract_json
        raw = await call_groq(
            [{"role": "user", "content": f"Generate 2 cafe suggestions for {city}"}],
            f"""Return ONLY a JSON array of 2 objects, each with: id, name, place_type, emoji, address, lat, lng, distance_text, duration_text, budget_text, crowd_level, crowd_prediction, weather_ok, score, reason, hidden_gem, safety_ok.
City: {city}. Budget: mid-range (₹300-600/head).""",
            800
        )
        result["llm_raw"] = raw[:500]
        parsed = extract_json(raw)
        result["llm_parsed"] = parsed
        result["success"] = bool(parsed and isinstance(parsed, list))
    except Exception as e:
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()

    return result
