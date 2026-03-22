"""Analytics — Trip Intelligence Dashboard + Weekly Digest."""
from fastapi import APIRouter, Depends
from routers.auth import get_current_user
from services.llm import llm_generate_trip_report
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/trip/{trip_id}")
async def get_trip_analytics(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Post-trip auto-generated intelligence report."""
    from routers.trips import _trips
    from routers.suggestions import router as _  # just for feedback access

    user_id = current_user["sub"]
    trip = next((t for t in _trips.get(user_id, []) if t["id"] == trip_id), None)
    if not trip:
        return {"error": "Trip not found"}

    budget_total = trip.get("budget_total", 0)
    budget_spent = trip.get("budget_spent", 0)

    analytics = {
        "trip_id": trip_id,
        "destination": trip.get("destination", ""),
        "total_spent": budget_spent,
        "budget_total": budget_total,
        "budget_remaining": budget_total - budget_spent,
        "budget_pct_used": round((budget_spent / budget_total * 100) if budget_total else 0, 1),
        "suggestions_shown": 0,
        "suggestions_accepted": 0,
        "acceptance_rate": 0.0,
        "time_optimized_hours": 0,
        "places_visited": [],
        "top_categories": [],
        "languages_used": ["en"],
        "trip_duration_days": _get_duration(trip),
    }

    # Generate AI narrative
    report_text = await llm_generate_trip_report(analytics)
    analytics["ai_report"] = report_text

    return analytics


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Overall user travel stats dashboard."""
    from routers.trips import _trips
    from routers.preferences import _prefs

    user_id = current_user["sub"]
    trips = _trips.get(user_id, [])
    prefs = _prefs.get(user_id, {})

    now = datetime.utcnow()
    past_trips = [t for t in trips if _is_past(t, now)]
    upcoming_trips = [t for t in trips if not _is_past(t, now)]

    total_spent = sum(t.get("budget_spent", 0) for t in trips)
    destinations = list(set(t.get("destination", "") for t in past_trips if t.get("destination")))

    return {
        "total_trips": len(trips),
        "past_trips": len(past_trips),
        "upcoming_trips": len(upcoming_trips),
        "total_spent": total_spent,
        "destinations_visited": destinations,
        "feedback_given": prefs.get("feedback_count", 0),
        "liked_types": prefs.get("liked_types", []),
        "travel_mode": prefs.get("travel_mode", "leisure"),
        "member_since": _get_earliest_trip_date(trips),
    }


@router.get("/weekly-digest")
async def get_weekly_digest(current_user: dict = Depends(get_current_user)):
    """Weekly travel digest — upcoming trips, reminders, weather preview."""
    from routers.trips import _trips
    from services.llm import call_groq

    user_id = current_user["sub"]
    trips = _trips.get(user_id, [])
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)

    upcoming = [t for t in trips if _is_upcoming_within(t, now, next_week)]

    prompt = f"Create a concise weekly travel digest for these upcoming trips: {upcoming}. Include prep checklist and tips. 3-4 bullet points max."
    try:
        digest_text = await call_groq([{"role": "user", "content": prompt}],
            "You are a travel assistant writing a weekly digest. Be concise and practical.", 400)
    except Exception:
        digest_text = "No upcoming trips this week."

    return {
        "week_of": now.strftime("%Y-%m-%d"),
        "upcoming_trips": upcoming,
        "digest": digest_text,
        "reminders": _build_reminders(upcoming),
    }


def _get_duration(trip: dict) -> int:
    try:
        s = datetime.fromisoformat(str(trip.get("start_date", "")).replace("Z", ""))
        e = datetime.fromisoformat(str(trip.get("end_date", "")).replace("Z", ""))
        return (e - s).days
    except Exception:
        return 1

def _is_past(trip: dict, now: datetime) -> bool:
    try:
        return datetime.fromisoformat(str(trip.get("end_date", "")).replace("Z", "")) < now
    except Exception:
        return False

def _is_upcoming_within(trip: dict, now: datetime, until: datetime) -> bool:
    try:
        start = datetime.fromisoformat(str(trip.get("start_date", "")).replace("Z", ""))
        return now <= start <= until
    except Exception:
        return False

def _get_earliest_trip_date(trips: list) -> str:
    dates = []
    for t in trips:
        d = t.get("created_at", "")
        if d:
            dates.append(d)
    return min(dates) if dates else datetime.utcnow().isoformat()

def _build_reminders(trips: list) -> list:
    reminders = []
    for t in trips:
        reminders.append(f"📋 Pack for {t.get('destination', 'your trip')}")
        if t.get("trip_type") == "flight":
            reminders.append("🛂 Check passport validity (6 months required)")
        reminders.append(f"💱 Check currency rates for {t.get('destination', 'destination')}")
    return reminders[:6]
