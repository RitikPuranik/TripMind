"""
LLM Service — 100% FREE tier only.

Primary:  Groq  (Llama 3.3 70B)   — console.groq.com   — free, fastest
Fallback: Google Gemini Flash 1.5  — aistudio.google.com — free 1500 req/day
Both are completely free. No Anthropic / OpenAI needed.
"""
import httpx
import logging
logger = logging.getLogger(__name__)
import json
import re
from typing import Optional
from utils.config import settings
from models.schemas import ParsedEmail

# ── Groq (primary) ────────────────────────────────────────────────────────────
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"   # free tier, fastest

# ── Google Gemini Flash (fallback) ────────────────────────────────────────────
GEMINI_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
GEMINI_MODEL = "gemini-1.5-flash"         # free: 1500 req/day, 1M tokens/min


async def call_groq(messages: list, system: str = "", max_tokens: int = 1000, json_mode: bool = False) -> str:
    """
    Call Groq API (Llama 3.3 70B) — FREE.
    Falls back to Gemini Flash if GROQ_API_KEY not set.
    """
    if not settings.GROQ_API_KEY:
        return await call_gemini(messages, system, max_tokens)

    all_messages = [{"role": "system", "content": system}, *messages] if system else messages
    payload: dict = {
        "model": GROQ_MODEL,
        "max_tokens": max_tokens,
        "messages": all_messages,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def call_gemini(messages: list, system: str = "", max_tokens: int = 1000) -> str:
    """
    Google Gemini 1.5 Flash — FREE fallback (1500 req/day).
    Get key free at: aistudio.google.com/app/apikey
    """
    if not settings.GEMINI_API_KEY:
        raise Exception(
            "No LLM API key found.\n"
            "Set GROQ_API_KEY (console.groq.com) — completely free.\n"
            "Or set GEMINI_API_KEY (aistudio.google.com) — also free."
        )

    # Convert OpenAI-style messages → Gemini format
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    payload = {
        "system_instruction": {"parts": [{"text": system}]} if system else None,
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    # Remove None keys
    payload = {k: v for k, v in payload.items() if v is not None}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def extract_json(text: str) -> Optional[dict | list]:
    """Safely extract JSON from LLM response."""
    parsed = None

    # Try direct parse
    try:
        parsed = json.loads(text)
    except Exception:
        pass

    # Try extracting from markdown code block
    if parsed is None:
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if match:
            try:
                parsed = json.loads(match.group(1))
            except Exception:
                pass

    # Try finding array or object in text
    if parsed is None:
        for pattern in (r'\[[\s\S]*\]', r'\{[\s\S]*\}'):
            match = re.search(pattern, text)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                    break
                except Exception:
                    pass

    if parsed is None:
        return None

    # If LLM wrapped the array in an object e.g. {"places":[...]} or {"suggestions":[...]}
    # unwrap it — we always want the list
    if isinstance(parsed, dict):
        for key in ('places', 'suggestions', 'results', 'items', 'data', 'recommendations'):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # If only one key and it's a list, use it
        values = list(parsed.values())
        if len(values) == 1 and isinstance(values[0], list):
            return values[0]

    return parsed


# ── Domain functions ──────────────────────────────────────────────────────────

async def llm_extract_trip_data(subject: str, body: str, message_id: str) -> Optional[ParsedEmail]:
    """Extract structured trip info from email content."""
    system = """You are a travel email parser. Extract trip information from emails.
Return ONLY valid JSON with these fields (null if not found):
{
  "email_type": "flight|hotel|cab|payment|visa|general",
  "destination": "city name or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "amount": number or null,
  "currency": "INR|USD|AED etc or null",
  "confirmation_number": "string or null",
  "raw_summary": "one sentence summary"
}
If this is not a travel email, return {"email_type": "not_travel"}."""

    prompt = f"Subject: {subject}\n\nBody:\n{body[:2000]}"
    try:
        reply = await call_groq([{"role": "user", "content": prompt}], system, 400, json_mode=True)
        data = extract_json(reply)
        if not data or data.get("email_type") == "not_travel":
            return None
        return ParsedEmail(
            message_id=message_id,
            subject=subject,
            email_type=data.get("email_type", "general"),
            destination=data.get("destination"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            amount=data.get("amount"),
            currency=data.get("currency"),
            confirmation_number=data.get("confirmation_number"),
            raw_summary=data.get("raw_summary", subject),
        )
    except Exception:
        return None


async def llm_generate_suggestions(
    city: str, lat: float, lng: float,
    free_minutes: int, weather_code: int, temperature: float,
    budget_level: str, dietary: str, interests: list,
    vibe: Optional[str], liked_types: list, disliked_types: list,
    hidden_gems_only: bool, group_profiles: Optional[list] = None,
) -> list:
    """Generate 4-6 ranked place suggestions using 6-factor scoring."""
    is_rain = 51 <= weather_code <= 82 if weather_code else False
    is_hot = temperature > 36 if temperature else False
    is_cold = temperature < 15 if temperature else False

    weather_constraint = (
        "INDOOR venues only (raining)" if is_rain
        else "AC/shaded venues preferred (hot weather)" if is_hot
        else "outdoor-friendly weather"
    )

    group_constraint = ""
    if group_profiles:
        names = [p.get("name", "User") for p in group_profiles]
        constraints = [f"{p['name']}: {p.get('dietary','')}, {p.get('interests','')}" for p in group_profiles]
        group_constraint = f"GROUP TRIP: Must satisfy all profiles: {'; '.join(constraints)}"

    system = f"""You are TripMind's recommendation engine for {city}.
Generate exactly 5 place suggestions. RANKING RULES (strictly follow):
1. TOP 2-3 must be the most WELL-KNOWN, POPULAR, HIGHLY-RATED places that locals and visitors both know
2. BOTTOM 1-2 can be hidden gems or lesser-known spots
3. Use REAL place names that actually exist in {city} — not generic names
4. Score popular/well-known places higher (0.85-1.0), hidden gems lower (0.65-0.80)

CONSTRAINTS:
- Free time: {free_minutes} minutes
- Weather: {weather_constraint} (code {weather_code}, temp {temperature}°C)
- Budget: {budget_level} (low=₹100-300, mid=₹300-800, high=₹800+ per head)
- Dietary: {dietary}
- Interests: {', '.join(interests) or 'general'}
- Vibe requested: {vibe or 'not specified'}
- Liked place types: {', '.join(liked_types) or 'none yet'}
- Disliked place types: {', '.join(disliked_types) or 'none'}
- {'HIDDEN GEMS ONLY: local spots, no tourist traps' if hidden_gems_only else 'TOP PRIORITY: famous well-known places first, then local gems'}
{group_constraint}

Return ONLY a JSON array of 5 objects sorted by score descending (highest first):
[{{
  "id": "unique_slug",
  "name": "REAL well-known place name in {city}",
  "place_type": "cafe|restaurant|park|museum|market|lounge|activity",
  "emoji": "single emoji",
  "address": "real area/neighborhood in {city}",
  "lat": approximate_lat,
  "lng": approximate_lng,
  "distance_text": "X min walk/drive",
  "duration_text": "~X mins stay",
  "budget_text": "₹XXX-XXX per head",
  "crowd_level": "low|medium|high",
  "crowd_prediction": "Quiet until Xpm, then busier",
  "weather_ok": true/false,
  "score": 0.0-1.0,
  "reason": "Suggested because: [2-3 specific reasons fitting current context]",
  "hidden_gem": false for popular places / true for local gems,
  "safety_ok": true,
  "etiquette_tip": "short tip or null"
}}]"""

    try:
        reply = await call_groq(
            [{"role": "user", "content": f"Generate 5 real well-known place suggestions specifically in {city}, India. Only suggest places that actually exist in {city}. Return ONLY the JSON array."}],
            system, 1500, json_mode=True
        )
        data = extract_json(reply)
        if isinstance(data, list) and len(data) > 0:
            return data
        logger.warning(f"LLM returned non-list for {city}: {type(data)} — raw: {reply[:200]}")
    except Exception as e:
        logger.error(f"llm_generate_suggestions failed for {city}: {e}")
    return []


async def llm_voice_response(
    transcript: str,
    detected_lang: str,
    context: dict,
    city: str,
) -> dict:
    """Process voice query and return multilingual response."""
    system = f"""You are TripMind, an AI travel companion. Reply in the SAME language the user speaks (detected: {detected_lang}).
Support code-switching — if user mixes Hindi and English, reply naturally in the same mix.
Be conversational, helpful, concise (2-4 sentences max).

CONTEXT:
- City: {city}
- Weather: {context.get('weather', 'unknown')}
- Calendar today: {context.get('calendar', 'no events')}
- Active trip: {context.get('trip', 'none')}
- Budget level: {context.get('budget_level', 'mid-range')}
- Dietary: {context.get('dietary', 'no restrictions')}

For place suggestions, give specific names with approximate per-head cost in INR.
If asking about travel, include practical tips.

Return JSON: {{"reply": "...", "reply_language": "{detected_lang}", "action": "suggest|navigate|inform|none"}}"""

    try:
        reply = await call_groq(
            [{"role": "user", "content": transcript}],
            system, 600, json_mode=True
        )
        data = extract_json(reply)
        if data:
            return data
    except Exception:
        pass
    return {"reply": "I couldn't process that right now. Please try again.", "reply_language": "en", "action": "none"}


async def llm_build_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    calendar_events: list,
    budget_level: str,
    dietary: str,
    interests: list,
) -> list:
    """Auto-build a day-by-day itinerary."""
    system = f"""You are a professional travel planner. Build a detailed day-by-day itinerary for {destination}.

TRIP: {start_date} to {end_date}
EXISTING CALENDAR EVENTS (do not overlap):
{json.dumps(calendar_events[:10], indent=2)}
BUDGET: {budget_level}
DIETARY: {dietary}
INTERESTS: {', '.join(interests) or 'general sightseeing'}

Fill ALL free gaps intelligently. Respect existing meetings/events.
Return a JSON array of day objects:
[{{
  "date": "YYYY-MM-DD",
  "day_label": "Day 1 — Arrival",
  "items": [
    {{
      "time": "HH:MM",
      "activity": "Name of activity/place",
      "location": "Address/Area",
      "duration_mins": 60,
      "category": "food|sightseeing|transport|hotel|meeting",
      "notes": "tip or detail",
      "budget_estimate": "₹XXX"
    }}
  ]
}}]"""

    try:
        reply = await call_groq(
            [{"role": "user", "content": f"Build itinerary for {destination} trip"}],
            system, 2000
        )
        data = extract_json(reply)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


async def llm_extract_preferences(feedback_text: str, current_prefs: dict) -> dict:
    """Extract preference updates from user feedback or chat."""
    system = """Extract travel preferences from user text. Return JSON with ONLY fields to update:
{
  "budget_level": "low|mid-range|high",
  "dietary": "vegetarian|vegan|halal|jain|no restrictions",
  "interests": ["array of interests"],
  "trip_purpose": "business|leisure",
  "language": "en|hi|ta|te|ar|ml|kn etc"
}
Only include fields you can confidently extract. Return {} if nothing extractable."""
    try:
        reply = await call_groq([{"role": "user", "content": feedback_text}], system, 300, json_mode=True)
        return extract_json(reply) or {}
    except Exception:
        return {}


async def llm_generate_trip_report(trip_data: dict) -> str:
    """Generate post-trip intelligence report."""
    system = "You are a travel analytics AI. Write a concise, insightful post-trip report in 3-4 paragraphs. Focus on insights, patterns, and suggestions for next time."
    try:
        reply = await call_groq([{"role": "user", "content": f"Trip data: {json.dumps(trip_data)}"}], system, 600)
        return reply
    except Exception:
        return "Trip report generation failed."