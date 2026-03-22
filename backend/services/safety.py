"""Safety & scam alert service."""
import httpx
from utils.config import settings

# Known unsafe areas (simplified — production uses FCDO/State Dept APIs)
UNSAFE_ZONES = []  # populated from API in production

async def check_safety(lat: float, lng: float) -> dict:
    """Check if a location has any safety advisories."""
    # In production: query UK FCDO or US State Dept travel advisory APIs
    # For now: return safe with placeholder
    return {
        "safe": True,
        "advisory_level": 1,   # 1=Normal, 2=Exercise caution, 3=Avoid non-essential, 4=Do not travel
        "notes": [],
        "scam_alerts": [],
    }
