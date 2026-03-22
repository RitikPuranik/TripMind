"""Weather service using Open-Meteo (free, no key needed)."""
import httpx
from typing import Optional

WMO_DESCRIPTIONS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Light showers", 81: "Moderate showers", 82: "Heavy showers",
    95: "Thunderstorm", 96: "Thunderstorm+hail", 99: "Severe thunderstorm",
}

async def get_weather(lat: float, lng: float) -> dict:
    """Fetch current weather + 3hr forecast from Open-Meteo."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lng,
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode,apparent_temperature",
                    "hourly": "temperature_2m,precipitation_probability,weathercode",
                    "timezone": "auto",
                    "forecast_days": 1,
                },
            )
        data = r.json()
        cur = data.get("current", {})
        hourly = data.get("hourly", {})

        # Next 3 hours rain risk
        rain_risk = max(hourly.get("precipitation_probability", [0])[:3]) if hourly.get("precipitation_probability") else 0
        code = cur.get("weathercode", 0)

        return {
            "temperature": round(cur.get("temperature_2m", 28), 1),
            "feels_like": round(cur.get("apparent_temperature", 28), 1),
            "humidity": cur.get("relative_humidity_2m", 60),
            "wind_speed": cur.get("wind_speed_10m", 10),
            "weathercode": code,
            "description": WMO_DESCRIPTIONS.get(code, "Fair weather"),
            "is_raining": 51 <= code <= 82,
            "is_hot": cur.get("temperature_2m", 28) > 36,
            "rain_risk_3h": rain_risk,
            "rain_alert": rain_risk > 60,
        }
    except Exception:
        return {"temperature": 28, "weathercode": 0, "description": "Unknown", "is_raining": False, "is_hot": False, "rain_risk_3h": 0, "rain_alert": False}
