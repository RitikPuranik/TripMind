"""Crowd prediction using time-based heuristics + Google Popular Times."""
from datetime import datetime
from typing import Optional

CROWD_PATTERNS = {
    "cafe": {
        "weekday": [2,3,5,7,8,9,9,8,6,5,4,3,2,2,3,4,6,7,8,9,8,6,4,2],
        "weekend": [2,2,3,4,5,7,8,9,9,9,8,7,6,6,7,8,8,7,6,5,4,3,2,2],
    },
    "restaurant": {
        "weekday": [1,1,1,1,1,1,2,4,7,9,9,9,8,6,4,3,4,6,9,9,8,6,3,1],
        "weekend": [1,1,1,1,1,1,2,5,8,9,9,9,9,8,7,6,7,8,9,9,8,6,4,2],
    },
    "market": {
        "weekday": [1,1,1,1,1,2,4,7,9,9,8,7,6,6,7,8,7,6,5,4,3,2,1,1],
        "weekend": [1,1,1,1,1,3,6,9,9,9,9,8,7,7,8,9,8,7,6,5,4,3,2,1],
    },
    "park": {
        "weekday": [1,1,1,1,1,2,5,7,8,8,7,6,5,4,4,5,6,8,8,7,5,3,2,1],
        "weekend": [1,1,1,1,1,3,6,8,9,9,8,7,7,7,8,9,8,7,6,5,4,3,2,1],
    },
    "default": {
        "weekday": [1,1,1,1,1,2,4,6,8,9,8,7,6,5,5,6,7,8,8,7,5,3,2,1],
        "weekend": [1,1,1,1,1,2,4,7,9,9,8,7,7,7,8,8,7,6,5,4,3,2,1,1],
    },
}


async def predict_crowd(place_name: str, lat: float, lng: float) -> dict:
    """Predict crowd level for a venue at current time and next 2 hours."""
    now = datetime.now()
    hour = now.hour
    is_weekend = now.weekday() >= 5

    # Guess place type from name
    name_lower = place_name.lower()
    if any(w in name_lower for w in ["café", "cafe", "coffee", "tea"]):
        ptype = "cafe"
    elif any(w in name_lower for w in ["restaurant", "dhaba", "biryani", "pizza", "burger", "food"]):
        ptype = "restaurant"
    elif any(w in name_lower for w in ["market", "bazar", "bazaar", "mall"]):
        ptype = "market"
    elif any(w in name_lower for w in ["park", "garden", "lake", "forest"]):
        ptype = "park"
    else:
        ptype = "default"

    pattern = CROWD_PATTERNS.get(ptype, CROWD_PATTERNS["default"])
    day_key = "weekend" if is_weekend else "weekday"
    hours = pattern[day_key]

    current_score = hours[hour]
    future_score = hours[min(hour + 2, 23)]

    level = "low" if current_score <= 4 else "high" if current_score >= 8 else "medium"
    future_level = "low" if future_score <= 4 else "high" if future_score >= 8 else "medium"

    if level == "low" and future_level == "high":
        prediction = f"Quiet now but gets busy around {hour+2}:00"
    elif level == "high" and future_level == "low":
        prediction = f"Busy now, quieter after {hour+2}:00"
    elif level == "low":
        prediction = "Quiet for the next few hours"
    elif level == "high":
        prediction = "Currently busy — consider going later"
    else:
        prediction = "Moderate crowds expected"

    return {
        "level": level,
        "score": current_score,
        "prediction": prediction,
        "best_time": _get_best_time(hours, hour),
    }


def _get_best_time(hours: list, from_hour: int) -> str:
    """Find lowest-crowd hour in next 6 hours."""
    window = hours[from_hour:min(from_hour+6, 24)]
    if not window:
        return "anytime"
    best_idx = window.index(min(window))
    best_hour = from_hour + best_idx
    return f"{best_hour:02d}:00"
