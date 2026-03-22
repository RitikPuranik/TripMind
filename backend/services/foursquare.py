"""Foursquare Places API — nearby POIs with local/hidden gem filtering."""
import httpx
from typing import Optional
from utils.config import settings

FSQ_URL = "https://api.foursquare.com/v3/places/search"

VIBE_TO_CATEGORIES = {
    "chill": "13065,13003",      # cafe, coffee shop
    "food": "13065,13000",       # restaurants
    "outdoor": "16000,16032",    # parks, nature
    "culture": "10000,10001",    # arts, museums
    "shopping": "17000",         # retail
    "nightlife": "13003,13035",  # bars, lounges
    "local": "13065,13003,13000",
    "hidden": "13065,13003",
    "family": "18000,16032",     # amusement, parks
}


async def get_nearby_places(lat: float, lng: float, city: str = "", vibe: Optional[str] = None) -> list:
    """Fetch real places from Foursquare (if API key is set)."""
    if not settings.FOURSQUARE_API_KEY:
        return []  # Fall back to LLM-generated suggestions

    categories = ""
    if vibe:
        vibe_lower = vibe.lower()
        for key, cats in VIBE_TO_CATEGORIES.items():
            if key in vibe_lower:
                categories = cats
                break

    params = {
        "ll": f"{lat},{lng}",
        "radius": 3000,
        "limit": 15,
        "sort": "RATING",
        "fields": "fsq_id,name,location,categories,rating,stats,price,hours,photos",
    }
    if categories:
        params["categories"] = categories

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                FSQ_URL,
                headers={"Authorization": settings.FOURSQUARE_API_KEY},
                params=params,
            )
        data = r.json()
        places = []
        for p in data.get("results", []):
            places.append({
                "fsq_id": p.get("fsq_id"),
                "name": p.get("name"),
                "address": p.get("location", {}).get("formatted_address", city),
                "lat": p.get("geocodes", {}).get("main", {}).get("latitude", lat),
                "lng": p.get("geocodes", {}).get("main", {}).get("longitude", lng),
                "category": p.get("categories", [{}])[0].get("name", "Place") if p.get("categories") else "Place",
                "rating": p.get("rating", 7.0),
                "price": p.get("price", 2),
                "is_open": p.get("hours", {}).get("open_now", True),
            })
        return places
    except Exception:
        return []
