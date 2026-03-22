"""Trips management — CRUD + auto-detection from Gmail/Calendar."""
from fastapi import APIRouter, Depends, HTTPException, Body
from routers.auth import get_current_user
from models.schemas import TripCreate, TripOut
from datetime import datetime
import uuid

router = APIRouter()

_trips: dict = {}  # user_id -> list of trips


@router.get("/")
async def list_trips(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    trips = _trips.get(user_id, [])
    now = datetime.utcnow()
    for t in trips:
        try:
            end = datetime.fromisoformat(str(t.get("end_date", "")).replace("Z", ""))
            start = datetime.fromisoformat(str(t.get("start_date", "")).replace("Z", ""))
            t["status"] = "past" if end < now else "active" if start <= now else "upcoming"
        except Exception:
            t["status"] = "upcoming"
    return {"trips": sorted(trips, key=lambda x: x.get("start_date", ""), reverse=True)}


@router.post("/")
async def create_trip(trip: TripCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    if user_id not in _trips:
        _trips[user_id] = []
    new_trip = {
        "id": str(uuid.uuid4()),
        **trip.dict(),
        "budget_spent": 0,
        "status": "upcoming",
        "source": "manual",
        "itinerary": None,
        "created_at": datetime.utcnow().isoformat(),
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
    }
    _trips[user_id].append(new_trip)
    return new_trip


@router.post("/import-from-gmail")
async def import_from_gmail(
    parsed_emails: list = Body(default=[]),
    current_user: dict = Depends(get_current_user),
):
    """Convert parsed Gmail emails into structured Trip records."""
    user_id = current_user["sub"]
    if user_id not in _trips:
        _trips[user_id] = []

    imported = []
    for email in parsed_emails:
        if not email.get("destination"):
            continue
        existing_ids = [t.get("source_email_id") for t in _trips[user_id]]
        if email.get("message_id") in existing_ids:
            continue
        trip = {
            "id": str(uuid.uuid4()),
            "destination": email.get("destination", "Unknown"),
            "city": email.get("destination"),
            "country": None,
            "start_date": email.get("start_date"),
            "end_date": email.get("end_date"),
            "trip_type": email.get("email_type", "general"),
            "budget_total": email.get("amount", 0) or 0,
            "budget_spent": 0,
            "currency": email.get("currency", "INR"),
            "status": "upcoming",
            "source": "gmail",
            "source_email_id": email.get("message_id"),
            "itinerary": None,
            "raw_summary": email.get("raw_summary", ""),
            "created_at": datetime.utcnow().isoformat(),
        }
        _trips[user_id].append(trip)
        imported.append(trip)

    return {"imported": len(imported), "trips": imported}


@router.get("/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    for t in _trips.get(user_id, []):
        if t["id"] == trip_id:
            return t
    raise HTTPException(404, "Trip not found")


@router.put("/{trip_id}/expense")
async def add_expense(
    trip_id: str,
    amount: float,
    category: str = "general",
    description: str = "",
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    for t in _trips.get(user_id, []):
        if t["id"] == trip_id:
            t["budget_spent"] = t.get("budget_spent", 0) + amount
            return {"trip_id": trip_id, "new_spent": t["budget_spent"]}
    raise HTTPException(404, "Trip not found")


@router.get("/active/current")
async def get_active_trip(current_user: dict = Depends(get_current_user)):
    """Get the currently active trip (if any)."""
    user_id = current_user["sub"]
    now = datetime.utcnow()
    for t in _trips.get(user_id, []):
        try:
            start = datetime.fromisoformat(str(t.get("start_date", "")).replace("Z", ""))
            end = datetime.fromisoformat(str(t.get("end_date", "")).replace("Z", ""))
            if start <= now <= end:
                return {"active": True, "trip": t}
        except Exception:
            continue
    return {"active": False, "trip": None}
