"""Google OAuth 2.0 authentication — Gmail + Calendar scopes."""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import json, jwt, uuid
from datetime import datetime, timedelta

from utils.config import settings
from models.schemas import TokenResponse

router = APIRouter()

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

# In-memory token store (use Redis/Supabase in production)
_token_store: dict = {}


def make_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )


def create_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = auth.split(" ", 1)[1]
    return decode_jwt(token)


@router.get("/login")
async def login():
    """Redirect user to Google OAuth consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env")
    flow = make_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"auth_url": auth_url, "state": state}


@router.get("/callback")
async def oauth_callback(code: str, state: str):
    """Handle Google OAuth callback, exchange code for tokens."""
    flow = make_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Get user info
    service = build("oauth2", "v2", credentials=creds)
    user_info = service.userinfo().get().execute()

    user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, user_info["email"]))

    # Store tokens (encrypt in production!)
    _token_store[user_id] = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
        "email": user_info["email"],
    }

    jwt_token = create_jwt(user_id, user_info["email"])

    # Redirect back to frontend with token
    frontend = settings.FRONTEND_URL
    return RedirectResponse(f"{frontend}/auth/callback?token={jwt_token}&user_id={user_id}&name={user_info.get('name','')}&email={user_info['email']}&avatar={user_info.get('picture','')}")


def get_google_creds(user_id: str) -> Credentials:
    """Retrieve stored Google credentials for a user."""
    data = _token_store.get(user_id)
    if not data:
        raise HTTPException(status_code=401, detail="Google credentials not found. Please re-authenticate.")
    return Credentials(
        token=data["token"],
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=data.get("client_id", settings.GOOGLE_CLIENT_ID),
        client_secret=data.get("client_secret", settings.GOOGLE_CLIENT_SECRET),
        scopes=data.get("scopes", SCOPES),
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    data = _token_store.get(user_id, {})
    return {
        "user_id": user_id,
        "email": current_user["email"],
        "google_connected": bool(data),
        "scopes": data.get("scopes", []),
    }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    _token_store.pop(user_id, None)
    return {"status": "logged out"}