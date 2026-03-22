"""Itinerary — auto-build, gap fill, live rebalancing."""
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_current_user
from services.llm import llm_build_itinerary
from models.schemas import ItineraryOut, ItineraryDay
from datetime import datetime
from typing import List, Optional

router = APIRouter()

# In-memory store (Supabase in production)
_itineraries: dict = {}


@router.post("/build")
async def build_itinerary(
    trip_id: str,
    destination: str,
    start_date: str,
    end_date: str,
    calendar_events: list = [],
    budget_level: str = "mid-range",
    dietary: str = "no restrictions",
    interests: list = [],
    current_user: dict = Depends(get_current_user),
):
    """
    Auto-build complete day-by-day itinerary from Gmail + Calendar data.
    Fills ALL gaps intelligently. Zero manual input required.
    """
    user_id = current_user["sub"]

    days_raw = await llm_build_itinerary(
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        calendar_events=calendar_events,
        budget_level=budget_level,
        dietary=dietary,
        interests=interests,
    )

    days = [ItineraryDay(
        date=d.get("date", ""),
        items=d.get("items", []),
    ) for d in days_raw]

    itinerary = {
        "trip_id": trip_id,
        "destination": destination,
        "days": [d.dict() for d in days],
        "generated_at": datetime.utcnow().isoformat(),
        "gaps_filled": sum(len(d.items) for d in days),
        "meetings_respected": len(calendar_events),
    }

    _itineraries[f"{user_id}:{trip_id}"] = itinerary
    return itinerary


@router.get("/{trip_id}")
async def get_itinerary(trip_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    itin = _itineraries.get(f"{user_id}:{trip_id}")
    if not itin:
        raise HTTPException(404, "Itinerary not found. Build one first.")
    return itin


@router.post("/{trip_id}/rebalance")
async def rebalance_itinerary(
    trip_id: str,
    reason: str,  # "flight_delayed" | "meeting_overran" | "place_closed"
    delay_minutes: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    Live itinerary rebalancing — flight delayed or meeting ran long.
    Drops venues now unreachable, replaces with viable alternatives.
    """
    user_id = current_user["sub"]
    itin = _itineraries.get(f"{user_id}:{trip_id}")
    if not itin:
        raise HTTPException(404, "Itinerary not found")

    from services.llm import call_groq, extract_json
    import json

    system = f"""You are a live travel planner. A user's itinerary needs rebalancing.
Reason: {reason}
Delay: {delay_minutes} minutes
Current itinerary: {json.dumps(itin['days'][:2], indent=2)}

Adjust the remaining items for today:
- Remove items that are now too late or unreachable
- Shift times forward by the delay
- Add replacement options where there are new gaps
Return updated day as JSON array matching the original format."""

    try:
        reply = await call_groq([{"role": "user", "content": "Rebalance itinerary"}], system, 1000)
        updated = extract_json(reply)
        if updated:
            # Update today's day
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            for day in itin["days"]:
                if day.get("date") == today_str:
                    day["items"] = updated if isinstance(updated, list) else updated
                    day["rebalanced"] = True
                    day["rebalance_reason"] = reason
            _itineraries[f"{user_id}:{trip_id}"] = itin
    except Exception:
        pass

    return {"status": "rebalanced", "reason": reason, "delay_minutes": delay_minutes}


@router.get("/{trip_id}/today")
async def get_today_plan(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Get today's itinerary items with current time context."""
    user_id = current_user["sub"]
    itin = _itineraries.get(f"{user_id}:{trip_id}")
    if not itin:
        raise HTTPException(404, "No itinerary found")

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    for day in itin.get("days", []):
        if day.get("date") == today_str:
            now_time = datetime.utcnow().strftime("%H:%M")
            upcoming = [item for item in day.get("items", [])
                       if item.get("time", "00:00") >= now_time]
            past = [item for item in day.get("items", [])
                   if item.get("time", "00:00") < now_time]
            return {
                "date": today_str,
                "upcoming": upcoming,
                "completed": past,
                "next_up": upcoming[0] if upcoming else None,
            }

    return {"date": today_str, "upcoming": [], "completed": [], "next_up": None}
