"""Google Calendar integration — free time detection, meeting analysis."""
from fastapi import APIRouter, Depends, HTTPException
from googleapiclient.discovery import build
from routers.auth import get_current_user, get_google_creds
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import pytz

router = APIRouter()


def parse_event(event: dict) -> dict:
    """Normalize a Google Calendar event."""
    start = event.get("start", {})
    end = event.get("end", {})
    return {
        "id": event.get("id"),
        "summary": event.get("summary", "Untitled"),
        "description": event.get("description", ""),
        "location": event.get("location", ""),
        "start": start.get("dateTime") or start.get("date"),
        "end": end.get("dateTime") or end.get("date"),
        "all_day": "date" in start and "dateTime" not in start,
        "color": event.get("colorId", "1"),
        "status": event.get("status", "confirmed"),
    }


@router.get("/events")
async def get_events(
    days_ahead: int = 14,
    current_user: dict = Depends(get_current_user)
):
    """Fetch calendar events for the next N days."""
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("calendar", "v3", credentials=creds)

    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    end = now + timedelta(days=days_ahead)

    try:
        result = service.events().list(
            calendarId="primary",
            timeMin=now.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=100,
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calendar API error: {str(e)}")

    events = [parse_event(e) for e in result.get("items", [])]
    return {"events": events, "count": len(events)}


@router.get("/today")
async def get_today_events(current_user: dict = Depends(get_current_user)):
    """Today's events with free-time gap analysis."""
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("calendar", "v3", credentials=creds)

    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0)
    end_of_day = now.replace(hour=23, minute=59, second=59)

    result = service.events().list(
        calendarId="primary",
        timeMin=start_of_day.isoformat(),
        timeMax=end_of_day.isoformat(),
        singleEvents=True,
        orderBy="startTime",
        maxResults=50,
    ).execute()

    events = [parse_event(e) for e in result.get("items", [])]
    free_slots = detect_free_slots(events, now)

    return {
        "events": events,
        "free_slots": free_slots,
        "total_free_minutes": sum(s["duration_minutes"] for s in free_slots),
        "busiest_period": get_busiest_period(events),
    }


def detect_free_slots(events: list, now: datetime) -> list:
    """Find gaps between calendar events > 30 minutes."""
    slots = []
    timed = [e for e in events if "T" in str(e.get("start", "")) and not e.get("all_day")]
    timed.sort(key=lambda e: e["start"])

    work_start = now.replace(hour=9, minute=0)
    work_end = now.replace(hour=21, minute=0)
    last_end = max(now, work_start)

    for event in timed:
        try:
            evt_start = datetime.fromisoformat(event["start"].replace("Z", "+00:00"))
            evt_end = datetime.fromisoformat(event["end"].replace("Z", "+00:00"))
            gap = int((evt_start - last_end).total_seconds() / 60)
            if gap >= 30 and last_end < work_end:
                slots.append({
                    "start": last_end.isoformat(),
                    "end": evt_start.isoformat(),
                    "duration_minutes": gap,
                    "label": f"{gap}min free before {event['summary']}",
                })
            last_end = max(last_end, evt_end)
        except Exception:
            continue

    # Slot after last event
    if last_end < work_end:
        gap = int((work_end - last_end).total_seconds() / 60)
        if gap >= 30:
            slots.append({
                "start": last_end.isoformat(),
                "end": work_end.isoformat(),
                "duration_minutes": gap,
                "label": f"{gap}min free this evening",
            })

    return slots


def get_busiest_period(events: list) -> Optional[str]:
    if not events:
        return None
    morning = sum(1 for e in events if e.get("start", "").split("T")[-1][:2] in ["08","09","10","11"])
    afternoon = sum(1 for e in events if e.get("start", "").split("T")[-1][:2] in ["12","13","14","15"])
    evening = sum(1 for e in events if e.get("start", "").split("T")[-1][:2] in ["16","17","18","19"])
    if max(morning, afternoon, evening) == 0:
        return None
    return ["morning", "afternoon", "evening"][[morning, afternoon, evening].index(max(morning, afternoon, evening))]


@router.get("/upcoming-trips")
async def detect_trips_from_calendar(current_user: dict = Depends(get_current_user)):
    """Detect travel events from calendar (location changes, multi-day events)."""
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("calendar", "v3", credentials=creds)

    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    end = now + timedelta(days=60)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        singleEvents=True,
        orderBy="startTime",
        maxResults=100,
    ).execute()

    travel_events = []
    travel_keywords = ["flight", "hotel", "trip", "travel", "vacation", "conference", "summit"]
    for e in result.get("items", []):
        summary = e.get("summary", "").lower()
        location = e.get("location", "")
        if any(kw in summary for kw in travel_keywords) or (location and location.strip()):
            travel_events.append(parse_event(e))

    return {"travel_events": travel_events}
