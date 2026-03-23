"""
LLM Service — Groq (Llama 3.3 70B) primary, Gemini Flash fallback.
Used for: ranking real Foursquare data, voice responses, email parsing, itinerary building.
NOT used for: generating place names (Foursquare does that now).
"""
import httpx
import logging
import json
import re
from typing import Optional
from utils.config import settings
from models.schemas import ParsedEmail

logger = logging.getLogger(__name__)

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


async def call_groq(messages: list, system: str = "", max_tokens: int = 1000, json_mode: bool = False) -> str:
    if not settings.GROQ_API_KEY:
        return await call_gemini(messages, system, max_tokens)

    all_messages = [{"role": "system", "content": system}, *messages] if system else messages
    payload: dict = {"model": GROQ_MODEL, "max_tokens": max_tokens, "messages": all_messages}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def call_gemini(messages: list, system: str = "", max_tokens: int = 1000) -> str:
    if not settings.GEMINI_API_KEY:
        raise Exception("No LLM key set. Add GROQ_API_KEY to .env")
    contents = [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in messages]
    payload = {"contents": contents, "generationConfig": {"maxOutputTokens": max_tokens}}
    if system:
        payload["system_instruction"] = {"parts": [{"text": system}]}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}", headers={"Content-Type": "application/json"}, json=payload)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def extract_json(text: str) -> Optional[dict | list]:
    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        pass
    if parsed is None:
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if match:
            try: parsed = json.loads(match.group(1))
            except Exception: pass
    if parsed is None:
        for pattern in (r'\[[\s\S]*\]', r'\{[\s\S]*\}'):
            match = re.search(pattern, text)
            if match:
                try: parsed = json.loads(match.group(0)); break
                except Exception: pass
    if parsed is None:
        return None
    # Unwrap common wrapper keys like {"places": [...]}
    if isinstance(parsed, dict):
        for key in ('places', 'suggestions', 'results', 'items', 'data', 'recommendations'):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        values = list(parsed.values())
        if len(values) == 1 and isinstance(values[0], list):
            return values[0]
    return parsed


async def llm_rank_and_describe(
    fsq_places: list,
    query: str,
    city: str,
    weather_code: int,
    temperature: float,
    budget_level: str,
    dietary: str,
    free_minutes: int,
) -> list:
    """
    Takes real Foursquare places and uses Groq to:
    1. Rank them by relevance to query + context
    2. Add a one-line reason for each
    3. Predict crowd level
    4. Add budget estimate in INR
    Returns enriched list sorted by score.
    """
    if not fsq_places:
        return []

    is_rain = 51 <= weather_code <= 82 if weather_code else False
    is_hot  = temperature > 36 if temperature else False

    places_summary = []
    for i, p in enumerate(fsq_places[:10]):
        places_summary.append({
            "index": i,
            "name": p["name"],
            "category": p["category"],
            "address": p["address"],
            "rating": p.get("rating"),
            "distance_m": p.get("distance_m", 0),
            "is_open": p.get("is_open"),
        })

    system = f"""You are TripMind's ranking engine. You receive REAL places fetched from Foursquare for {city}.
Your job is to rank them and add context. Do NOT invent new places.

USER QUERY: "{query}"
CONTEXT:
- City: {city}
- Weather: {"Raining — prefer indoor" if is_rain else f"{temperature}°C {'very hot' if is_hot else 'comfortable'}"}
- Budget: {budget_level} (low=₹100-300, mid=₹200-600, high=₹600+)
- Dietary: {dietary}
- Free time: {free_minutes} mins

For each place, return a JSON array with these fields:
- index: (same as input)
- score: 0.0-1.0 (how well it matches the query and context)
- reason: "Suggested because: [specific 1-2 reasons]"
- crowd_level: "low/medium/high" (estimate based on time and category)
- crowd_prediction: "one short sentence about when it's busy"
- budget_text: "₹XXX-XXX per head" (realistic estimate for {city})
- weather_ok: true/false
- hidden_gem: true if rating < 8.0 and low checkins, else false
- duration_text: "~XX mins stay"

Return ONLY the JSON array sorted by score descending. No markdown."""

    try:
        reply = await call_groq(
            [{"role": "user", "content": f"Rank these {len(places_summary)} places: {json.dumps(places_summary)}"}],
            system, 1200, json_mode=True
        )
        rankings = extract_json(reply)
        if not isinstance(rankings, list):
            return []

        # Merge Foursquare data with LLM rankings
        result = []
        for r in rankings:
            idx = r.get("index", 0)
            if idx >= len(fsq_places):
                continue
            p = fsq_places[idx]
            result.append({
                "id":               p["fsq_id"] or f"fsq_{idx}",
                "name":             p["name"],
                "place_type":       p["category"].lower().split()[0],
                "emoji":            p["emoji"],
                "address":          p["address"],
                "lat":              p["lat"],
                "lng":              p["lng"],
                "distance_text":    fsq_distance_text(p.get("distance_m", 0)),
                "duration_text":    r.get("duration_text", "~60 mins"),
                "budget_text":      r.get("budget_text", p["budget_text"]),
                "crowd_level":      r.get("crowd_level", "medium"),
                "crowd_prediction": r.get("crowd_prediction", "Moderate crowds expected"),
                "weather_ok":       r.get("weather_ok", True),
                "score":            float(r.get("score", 0.7)),
                "reason":           r.get("reason", f"Well-rated {p['category']} in {city}"),
                "hidden_gem":       bool(r.get("hidden_gem", False)),
                "safety_ok":        True,
                "etiquette_tip":    None,
                "rating":           p.get("rating"),
                "is_open":          p.get("is_open"),
                "website":          p.get("website", ""),
            })

        result.sort(key=lambda x: x["score"], reverse=True)
        return result

    except Exception as e:
        logger.error(f"LLM ranking failed: {e}")
        # Return unranked Foursquare data as fallback
        return _fsq_to_suggestions_fallback(fsq_places, city)


def _fsq_to_suggestions_fallback(fsq_places: list, city: str) -> list:
    """Convert Foursquare places to suggestion format without LLM ranking."""
    result = []
    for i, p in enumerate(fsq_places[:6]):
        result.append({
            "id":               p.get("fsq_id") or f'{p["name"].lower().replace(" ","_")}_{i}',
            "name":             p["name"],
            "place_type":       p["category"].lower().split()[0],
            "emoji":            p["emoji"],
            "address":          p["address"],
            "lat":              p["lat"],
            "lng":              p["lng"],
            "distance_text":    fsq_distance_text(p.get("distance_m", 0)),
            "duration_text":    "~60 mins",
            "budget_text":      p.get("budget_text", "₹200-500 per head"),
            "crowd_level":      "medium",
            "crowd_prediction": "Moderate crowds expected",
            "weather_ok":       True,
            "score":            float(p.get("rating", 7.0)) / 10.0,
            "reason":           f"Suggested because: highly rated {p['category']} in {city}",
            "hidden_gem":       False,
            "safety_ok":        True,
            "etiquette_tip":    None,
            "rating":           p.get("rating"),
            "is_open":          p.get("is_open"),
        })
    result.sort(key=lambda x: x["score"], reverse=True)
    return result


def fsq_distance_text(meters: int) -> str:
    if not meters: return "Nearby"
    if meters < 300:  return f"{meters}m · 3 min walk"
    if meters < 800:  return f"{meters}m · {meters//80} min walk"
    if meters < 2000: return f"{meters/1000:.1f} km · {meters//80} min walk"
    return f"{meters/1000:.1f} km · {meters//400} min drive"


# ── Legacy LLM-only suggestions (fallback when Foursquare unavailable) ────────
async def llm_generate_suggestions_fallback(
    city: str, lat: float, lng: float,
    free_minutes: int, weather_code: int, temperature: float,
    budget_level: str, dietary: str, interests: list,
    vibe: Optional[str], hidden_gems_only: bool,
) -> list:
    """Used ONLY when Foursquare API key is not set."""
    is_rain = 51 <= weather_code <= 82 if weather_code else False
    is_hot  = temperature > 36 if temperature else False
    weather_str = "INDOOR venues only (raining)" if is_rain else f"{temperature}°C {'hot' if is_hot else 'comfortable'}"

    system = f"""You are TripMind for {city}. Generate 5 REAL well-known places.
TOP 3 must be the most famous places in {city} that everyone knows.
Use REAL names that actually exist in {city} right now.
Weather: {weather_str} | Budget: {budget_level} | Query: {vibe or 'general'}
Return ONLY JSON array."""

    try:
        reply = await call_groq(
            [{"role": "user", "content": f"Give 5 real well-known places in {city} for: {vibe or 'general exploration'}"}],
            system, 1200, json_mode=True
        )
        data = extract_json(reply)
        if isinstance(data, list) and data:
            return data
    except Exception as e:
        logger.error(f"LLM fallback failed: {e}")
    return []


# ── Other LLM functions (unchanged) ──────────────────────────────────────────
async def llm_extract_trip_data(subject: str, body: str, message_id: str) -> Optional[ParsedEmail]:
    system = """You are a travel email parser. Extract trip info. Return ONLY JSON:
{"email_type":"flight|hotel|cab|payment|visa|general","destination":null,"start_date":null,"end_date":null,"amount":null,"currency":null,"confirmation_number":null,"raw_summary":"one sentence"}
If not travel email: {"email_type":"not_travel"}"""
    try:
        reply = await call_groq([{"role": "user", "content": f"Subject: {subject}\n\n{body[:2000]}"}], system, 400, json_mode=True)
        data = extract_json(reply)
        if not data or data.get("email_type") == "not_travel":
            return None
        return ParsedEmail(
            message_id=message_id, subject=subject,
            email_type=data.get("email_type", "general"),
            destination=data.get("destination"), start_date=data.get("start_date"),
            end_date=data.get("end_date"), amount=data.get("amount"),
            currency=data.get("currency"), confirmation_number=data.get("confirmation_number"),
            raw_summary=data.get("raw_summary", subject),
        )
    except Exception:
        return None


async def llm_voice_response(transcript: str, detected_lang: str, context: dict, city: str) -> dict:
    system = f"""You are TripMind. Reply in the SAME language as the user (detected: {detected_lang}).
Support Hindi-English code-switching. Be concise (2-4 sentences).
Context: city={city}, weather={context.get('weather')}, budget={context.get('budget_level')}, dietary={context.get('dietary')}
Return JSON: {{"reply":"...","reply_language":"{detected_lang}","action":"suggest|navigate|inform|none"}}"""
    try:
        reply = await call_groq([{"role": "user", "content": transcript}], system, 600, json_mode=True)
        data = extract_json(reply)
        if data: return data
    except Exception:
        pass
    return {"reply": "Sorry, could not process that. Please try again.", "reply_language": "en", "action": "none"}


async def llm_build_itinerary(destination: str, start_date: str, end_date: str, calendar_events: list, budget_level: str, dietary: str, interests: list) -> list:
    system = f"""Build a day-by-day itinerary for {destination} from {start_date} to {end_date}.
Budget: {budget_level} | Dietary: {dietary} | Interests: {', '.join(interests) or 'general'}
Return JSON array of days: [{{"date":"YYYY-MM-DD","day_label":"Day 1 — Arrival","items":[{{"time":"HH:MM","activity":"...","location":"...","duration_mins":60,"category":"food|sightseeing|transport","notes":"...","budget_estimate":"₹XXX"}}]}}]"""
    try:
        reply = await call_groq([{"role": "user", "content": f"Build itinerary for {destination}"}], system, 2000)
        data = extract_json(reply)
        if isinstance(data, list): return data
    except Exception as e:
        logger.error(f"Itinerary build failed: {e}")
    return []


async def llm_extract_preferences(feedback_text: str, current_prefs: dict) -> dict:
    system = """Extract travel preferences from text. Return ONLY JSON with fields to update:
{"budget_level":"low|mid-range|high","dietary":"...","interests":[],"trip_purpose":"business|leisure","language":"en|hi|..."}
Only include fields you can confidently extract. Return {} if nothing found."""
    try:
        reply = await call_groq([{"role": "user", "content": feedback_text}], system, 300, json_mode=True)
        return extract_json(reply) or {}
    except Exception:
        return {}


async def llm_generate_trip_report(trip_data: dict) -> str:
    system = "Write a concise post-trip report (3-4 paragraphs). Focus on insights and suggestions for next time."
    try:
        return await call_groq([{"role": "user", "content": f"Trip: {json.dumps(trip_data)}"}], system, 600)
    except Exception:
        return "Trip report generation failed."