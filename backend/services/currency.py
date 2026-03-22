"""Currency exchange rate service."""
import httpx
from utils.config import settings

async def get_exchange_rate(from_curr: str = "INR", to_curr: str = "AED") -> dict:
    try:
        url = f"https://open.er-api.com/v6/latest/{from_curr}"
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url)
        data = r.json()
        rate = data.get("rates", {}).get(to_curr, 0)
        return {"from": from_curr, "to": to_curr, "rate": rate, "change_pct": 0.0}
    except Exception:
        return {"from": from_curr, "to": to_curr, "rate": 0, "change_pct": 0.0}
