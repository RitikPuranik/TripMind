"""Foursquare Places API v3 — real-time venue data."""
import httpx
import logging
from typing import Optional
from utils.config import settings

logger = logging.getLogger(__name__)

FSQ_SEARCH  = "https://api.foursquare.com/v3/places/search"
FSQ_GEOCODE = "https://api.foursquare.com/v3/places/search"

# Foursquare category IDs
CATEGORY_MAP = {
    "cafe":        "13032,13033,13034,13035",  # cafes, coffee
    "coffee":      "13032,13033,13034",
    "restaurant":  "13000,13001,13002,13003,13004,13005,13006,13007,13008,13009,13010,13011,13012,13013,13014,13015,13016,13017,13018,13019,13020,13021,13022,13023,13024,13025,13026,13027,13028,13029,13030,13031",
    "food":        "13000",
    "park":        "16032,16033,16034,16035",
    "outdoor":     "16000,16032,16033",
    "museum":      "10001,10002,10003",
    "culture":     "10000,10001,10002,10003",
    "shopping":    "17000,17001,17002,17003",
    "mall":        "17069",
    "bar":         "13003,13004,13005",
    "nightlife":   "13003,13004,13005,13006",
    "hotel":       "19014,19015,19016",
    "attraction":  "16000,16001,16002,16003,16004,16005",
}

def _get_categories(query: str) -> str:
    """Map a query string to Foursquare category IDs."""
    q = query.lower()
    for key, cats in CATEGORY_MAP.items():
        if key in q:
            return cats
    return ""  # no category filter = search all


async def search_places(
    query: str,
    lat: float,
    lng: float,
    city: str = "",
    radius: int = 5000,
    limit: int = 10,
    near: str = "",
) -> list:
    """
    Search Foursquare for real current places.
    Returns live venue data — not LLM-generated.
    """
    if not settings.FOURSQUARE_API_KEY:
        return []

    headers = {
        "Authorization": settings.FOURSQUARE_API_KEY,
        "Accept": "application/json",
    }

    params = {
        "query": query,
        "limit": limit,
        "sort": "RELEVANCE",
        "fields": "fsq_id,name,location,categories,rating,stats,price,hours,distance,photos,description,website,tel",
    }

    # If we have real GPS coords, use them
    if lat and lng and lat != 20.5937:
        params["ll"] = f"{lat},{lng}"
        params["radius"] = radius
    elif city or near:
        # Use city name for geocoding
        params["near"] = city or near
    else:
        return []

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(FSQ_SEARCH, headers=headers, params=params)

        if r.status_code != 200:
            logger.warning(f"Foursquare returned {r.status_code}: {r.text[:200]}")
            return []

        data = r.json()
        results = []

        for p in data.get("results", []):
            loc = p.get("location", {})
            geo = p.get("geocodes", {}).get("main", {})
            cats = p.get("categories", [])
            hours = p.get("hours", {})

            # Build budget text from price tier
            price = p.get("price", 2)
            budget_map = {1: "₹100-200", 2: "₹200-500", 3: "₹500-1000", 4: "₹1000+"}

            # Pick emoji from category
            cat_name = cats[0].get("name", "Place").lower() if cats else "place"
            emoji = _cat_to_emoji(cat_name)

            results.append({
                "fsq_id":        p.get("fsq_id", ""),
                "name":          p.get("name", "Unknown"),
                "category":      cats[0].get("name", "Place") if cats else "Place",
                "emoji":         emoji,
                "address":       loc.get("formatted_address") or loc.get("address") or city,
                "neighborhood":  loc.get("neighborhood", [""])[0] if loc.get("neighborhood") else "",
                "lat":           float(geo.get("latitude",  lat)),
                "lng":           float(geo.get("longitude", lng)),
                "rating":        float(p.get("rating", 0)) if p.get("rating") else None,
                "price_tier":    price,
                "budget_text":   budget_map.get(price, "₹200-500 per head"),
                "is_open":       hours.get("open_now"),
                "distance_m":    p.get("distance", 0),
                "website":       p.get("website", ""),
                "description":   p.get("description", ""),
                "checkins":      p.get("stats", {}).get("total_checkins", 0),
            })

        # Sort by rating descending (most popular first)
        results.sort(key=lambda x: (x["rating"] or 0, x["checkins"]), reverse=True)
        return results

    except Exception as e:
        logger.error(f"Foursquare search error: {e}")
        return []


def _cat_to_emoji(cat: str) -> str:
    """Map category name to emoji."""
    c = cat.lower()
    if any(w in c for w in ["coffee", "café", "cafe"]):  return "☕"
    if any(w in c for w in ["pizza"]):                   return "🍕"
    if any(w in c for w in ["burger", "fast food"]):     return "🍔"
    if any(w in c for w in ["indian", "biryani"]):       return "🍛"
    if any(w in c for w in ["chinese"]):                 return "🍜"
    if any(w in c for w in ["restaurant", "dining"]):    return "🍽️"
    if any(w in c for w in ["bar", "pub", "brewery"]):   return "🍺"
    if any(w in c for w in ["park", "garden", "nature"]): return "🌿"
    if any(w in c for w in ["museum", "art", "gallery"]): return "🏛️"
    if any(w in c for w in ["mall", "shop", "market"]):   return "🛍️"
    if any(w in c for w in ["hotel", "resort"]):          return "🏨"
    if any(w in c for w in ["gym", "fitness"]):           return "💪"
    if any(w in c for w in ["spa", "salon"]):             return "💆"
    if any(w in c for w in ["cinema", "movie", "theater"]): return "🎭"
    if any(w in c for w in ["temple", "mosque", "church"]): return "🛕"
    if any(w in c for w in ["waterfall", "lake", "river"]): return "💧"
    return "📍"


def fsq_to_distance_text(meters: int) -> str:
    if not meters: return "Nearby"
    if meters < 200:  return "2 min walk"
    if meters < 500:  return f"{meters}m walk"
    if meters < 1500: return f"{round(meters/100)*100}m · {meters//80} min walk"
    return f"{meters/1000:.1f} km · {meters//400} min drive"