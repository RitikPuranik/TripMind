"""Flight status via AviationStack API."""
import httpx
from utils.config import settings

async def get_flight_status(flight_number: str) -> dict:
    if not settings.AVIATIONSTACK_API_KEY:
        return {"status": "unknown", "gate": None, "delay_mins": 0}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "http://api.aviationstack.com/v1/flights",
                params={"access_key": settings.AVIATIONSTACK_API_KEY, "flight_iata": flight_number, "limit": 1},
            )
        data = r.json()
        flights = data.get("data", [])
        if not flights:
            return {"status": "not_found", "gate": None, "delay_mins": 0}
        f = flights[0]
        dep = f.get("departure", {})
        return {
            "flight": flight_number,
            "status": f.get("flight_status", "unknown"),
            "gate": dep.get("gate"),
            "terminal": dep.get("terminal"),
            "delay_mins": dep.get("delay", 0) or 0,
            "scheduled": dep.get("scheduled"),
            "estimated": dep.get("estimated"),
        }
    except Exception:
        return {"status": "error", "gate": None, "delay_mins": 0}
