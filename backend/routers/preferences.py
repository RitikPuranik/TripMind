"""User preferences + Sentence Transformer preference learning."""
from fastapi import APIRouter, Depends
from routers.auth import get_current_user
from services.llm import llm_extract_preferences
from models.schemas import PreferenceUpdate, PreferenceOut
from datetime import datetime

router = APIRouter()

_prefs: dict = {}  # user_id -> prefs dict


def _default_prefs(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "budget_level": "mid-range",
        "dietary": "no restrictions",
        "interests": [],
        "trip_purpose": "leisure",
        "language": "en",
        "notification_freq": "normal",
        "travel_mode": "leisure",
        "home_city": "",
        "whatsapp_number": "",
        "feedback_count": 0,
        "liked_types": [],
        "disliked_types": [],
        "updated_at": datetime.utcnow().isoformat(),
    }


@router.get("/")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return _prefs.get(user_id, _default_prefs(user_id))


@router.put("/")
async def update_preferences(
    update: PreferenceUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    prefs = _prefs.get(user_id, _default_prefs(user_id))
    for field, value in update.dict(exclude_none=True).items():
        prefs[field] = value
    prefs["updated_at"] = datetime.utcnow().isoformat()
    _prefs[user_id] = prefs
    return prefs


@router.post("/learn-from-text")
async def learn_from_text(
    text: str,
    current_user: dict = Depends(get_current_user),
):
    """Extract and apply preference updates from free-form text (chat/voice)."""
    user_id = current_user["sub"]
    prefs = _prefs.get(user_id, _default_prefs(user_id))
    updates = await llm_extract_preferences(text, prefs)
    if updates:
        prefs.update(updates)
        prefs["updated_at"] = datetime.utcnow().isoformat()
        _prefs[user_id] = prefs
        return {"updated": True, "fields_changed": list(updates.keys()), "preferences": prefs}
    return {"updated": False, "preferences": prefs}


@router.post("/feedback-signal")
async def record_feedback_signal(
    suggestion_type: str,
    vote: str,  # "up" | "down"
    current_user: dict = Depends(get_current_user),
):
    """
    Record thumbs up/down signal.
    Updates liked_types / disliked_types for future suggestion ranking.
    """
    user_id = current_user["sub"]
    prefs = _prefs.get(user_id, _default_prefs(user_id))
    prefs["feedback_count"] = prefs.get("feedback_count", 0) + 1

    if vote == "up":
        liked = prefs.get("liked_types", [])
        if suggestion_type not in liked:
            liked.append(suggestion_type)
        prefs["liked_types"] = liked[-20:]  # keep last 20
    elif vote == "down":
        disliked = prefs.get("disliked_types", [])
        if suggestion_type not in disliked:
            disliked.append(suggestion_type)
        prefs["disliked_types"] = disliked[-20:]

    prefs["updated_at"] = datetime.utcnow().isoformat()
    _prefs[user_id] = prefs
    return {"status": "recorded", "feedback_count": prefs["feedback_count"]}


@router.get("/travel-modes")
async def get_travel_modes(current_user: dict = Depends(get_current_user)):
    return {
        "modes": [
            {"id": "leisure", "label": "Leisure", "icon": "🌴",
             "description": "Relaxed pace, hidden gems, local experiences"},
            {"id": "business", "label": "Business", "icon": "💼",
             "description": "Efficient, near meeting venues, good WiFi"},
            {"id": "adventure", "label": "Adventure", "icon": "🧗",
             "description": "Outdoor, active, off-beaten-path"},
            {"id": "family", "label": "Family", "icon": "👨‍👩‍👧",
             "description": "Kid-friendly, safe, comfortable"},
        ]
    }
