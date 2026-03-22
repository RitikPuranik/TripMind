"""Quick diagnostics — open these URLs in browser after logging in."""
from fastapi import APIRouter, Depends
from routers.auth import get_current_user
from utils.config import settings
import httpx, traceback

router = APIRouter()

@router.get("/groq")
async def test_groq(current_user: dict = Depends(get_current_user)):
    result = {
        "key_set": bool(settings.GROQ_API_KEY),
        "key_preview": (settings.GROQ_API_KEY[:12] + "...") if settings.GROQ_API_KEY else "NOT SET — add GROQ_API_KEY to backend/.env",
        "status": None,
        "http_status": None,
        "response": None,
        "error": None,
        "fix": None,
    }

    if not settings.GROQ_API_KEY:
        result["status"] = "FAIL"
        result["fix"] = "Add GROQ_API_KEY=gsk_... to D:/TripMind/backend/.env then restart backend"
        return result

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "max_tokens": 50,
                    "messages": [{"role": "user", "content": "Say hello in one word."}],
                },
            )
            result["http_status"] = r.status_code

            if r.status_code == 200:
                result["status"] = "OK"
                result["response"] = r.json()["choices"][0]["message"]["content"]
                result["fix"] = None

            elif r.status_code == 401:
                result["status"] = "FAIL — Invalid API key"
                result["fix"] = "Your GROQ_API_KEY is wrong. Get a new one at console.groq.com → API Keys"
                result["error"] = r.text[:300]

            elif r.status_code == 429:
                result["status"] = "FAIL — Rate limit hit"
                result["fix"] = "You've hit Groq's free tier limit. Wait a minute and try again, or get a new key at console.groq.com"
                result["error"] = r.text[:300]

            else:
                result["status"] = f"FAIL — HTTP {r.status_code}"
                result["error"] = r.text[:300]
                result["fix"] = "Unexpected error from Groq — check error field above"

    except httpx.ConnectError:
        result["status"] = "FAIL — Cannot reach Groq"
        result["fix"] = "No internet connection or Groq is blocked. Check your network."
    except Exception as e:
        result["status"] = "FAIL — Exception"
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()

    return result


@router.get("/suggestions-raw")
async def test_suggestions_raw(
    city: str = "Bhopal",
    current_user: dict = Depends(get_current_user),
):
    """Test the full suggestion pipeline and show raw LLM output."""
    from services.llm import call_groq, extract_json

    result = {"city": city, "llm_raw": None, "parsed": None, "error": None, "count": 0}
    try:
        raw = await call_groq(
            [{"role": "user", "content": f"Suggest 3 cafes in {city}. Return ONLY a JSON array."}],
            f"You are a place recommendation engine. Return ONLY a valid JSON array of 3 objects each with: id, name, place_type, emoji, address, lat, lng, distance_text, duration_text, budget_text, crowd_level, crowd_prediction, weather_ok, score, reason, hidden_gem, safety_ok. City: {city}.",
            800, json_mode=True
        )
        result["llm_raw"] = raw[:1000]
        parsed = extract_json(raw)
        result["parsed"] = parsed
        result["count"] = len(parsed) if isinstance(parsed, list) else 0
        result["status"] = "OK" if result["count"] > 0 else "FAIL — got 0 suggestions"
    except Exception as e:
        result["error"] = str(e)
        result["status"] = "FAIL"

    return result
