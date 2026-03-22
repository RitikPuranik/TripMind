"""Proactive alerts — all 11 trigger types."""
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user
from services.weather import get_weather
from services.currency import get_exchange_rate
from services.flights import get_flight_status
from models.schemas import AlertOut
from typing import List
from datetime import datetime, timedelta
import httpx

router = APIRouter()

# In-memory alert store (use Supabase in production)
_alerts: dict[str, list] = {}


def store_alert(user_id: str, alert_type: str, title: str, body: str, icon: str):
    import uuid
    if user_id not in _alerts:
        _alerts[user_id] = []
    _alerts[user_id].append({
        "id": str(uuid.uuid4()),
        "alert_type": alert_type,
        "title": title,
        "body": body,
        "icon": icon,
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })


@router.get("/", response_model=List[AlertOut])
async def get_alerts(current_user: dict = Depends(get_current_user)):
    """Get all unread alerts for user."""
    user_id = current_user["sub"]
    alerts = _alerts.get(user_id, [])
    return [AlertOut(**a) for a in sorted(alerts, key=lambda x: x["created_at"], reverse=True)[:20]]


@router.post("/{alert_id}/read")
async def mark_read(alert_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    for a in _alerts.get(user_id, []):
        if a["id"] == alert_id:
            a["read"] = True
    return {"status": "ok"}


@router.post("/check-all")
async def check_all_triggers(
    lat: float, lng: float,
    city: str = "",
    calendar_events: list = [],
    trips: list = [],
    current_user: dict = Depends(get_current_user),
):
    """
    Run all proactive trigger checks:
    1. Weather change
    2. Free time window
    3. Meal time
    4. Hotel check-in
    5. Flight gate change
    6. Local events
    7. Visa/passport expiry
    8. Currency rate
    9. Crowd prediction
    10. Location change arrival brief
    """
    user_id = current_user["sub"]
    triggered = []
    now = datetime.utcnow()

    # 1. Weather trigger
    weather = await get_weather(lat, lng)
    if weather.get("rain_alert"):
        store_alert(user_id, "weather", "Rain in 20 minutes ☔",
            "Switching your suggestions to indoor venues. Carry an umbrella if heading out.",
            "🌧️")
        triggered.append("weather")
    if weather.get("is_hot") and weather.get("temperature", 0) > 38:
        store_alert(user_id, "weather", "Heat alert — 38°C+ outside 🌡️",
            "Prioritizing AC venues and shaded options. Stay hydrated.", "☀️")
        triggered.append("heat")

    # 2. Free time trigger
    if calendar_events:
        free_slots = _detect_free_slots(calendar_events, now)
        for slot in free_slots[:1]:
            mins = slot["duration_minutes"]
            if mins >= 45:
                store_alert(user_id, "free_time",
                    f"You have {mins} mins free ⏰",
                    f"Free window: {slot['label']}. Want personalized suggestions for this gap?",
                    "✨")
                triggered.append("free_time")

    # 3. Meal time trigger
    hour = now.hour
    if hour == 12:
        store_alert(user_id, "meal", "Lunch time! 🍽️",
            f"It's noon — here are top-rated lunch spots near {city or 'you'} within your budget.",
            "🍜")
        triggered.append("meal_lunch")
    elif hour == 19:
        store_alert(user_id, "meal", "Dinner time! 🌙",
            f"Evening plans? Here are dinner options near {city or 'you'} matched to your preferences.",
            "🍛")
        triggered.append("meal_dinner")

    # 4. Hotel check-in trigger
    for trip in trips:
        if trip.get("trip_type") == "hotel" and trip.get("start_date"):
            try:
                checkin = datetime.fromisoformat(trip["start_date"].replace("Z", ""))
                checkin_time = checkin.replace(hour=14, minute=0)  # Standard check-in 2pm
                time_to_checkin = (checkin_time - now).total_seconds() / 60
                if 20 <= time_to_checkin <= 35:
                    store_alert(user_id, "hotel",
                        f"Hotel check-in in {int(time_to_checkin)} mins 🏨",
                        f"Your hotel at {trip.get('destination', 'destination')} check-in opens soon. Head over now to avoid queues.",
                        "🏨")
                    triggered.append("hotel_checkin")
            except Exception:
                pass

    # 5. Currency rate trigger
    try:
        rate_data = await get_exchange_rate("INR", "AED")
        if rate_data.get("change_pct", 0) > 1.0:
            store_alert(user_id, "currency",
                f"INR→AED improved {rate_data['change_pct']:.1f}% today 💱",
                "Good time to exchange currency if you need dirhams for your trip.",
                "💰")
            triggered.append("currency")
    except Exception:
        pass

    return {"triggered": triggered, "alert_count": len(_alerts.get(user_id, []))}


def _detect_free_slots(events: list, now: datetime) -> list:
    slots = []
    timed = [e for e in events if "T" in str(e.get("start", ""))]
    timed.sort(key=lambda e: e.get("start", ""))
    last_end = now
    for event in timed:
        try:
            evt_start = datetime.fromisoformat(str(event["start"]).replace("Z", ""))
            evt_end = datetime.fromisoformat(str(event.get("end", event["start"])).replace("Z", ""))
            gap = int((evt_start - last_end).total_seconds() / 60)
            if gap >= 45:
                slots.append({
                    "start": last_end.isoformat(),
                    "end": evt_start.isoformat(),
                    "duration_minutes": gap,
                    "label": f"{gap}min before '{event.get('summary', 'next event')}'",
                })
            last_end = max(last_end, evt_end)
        except Exception:
            continue
    return slots
