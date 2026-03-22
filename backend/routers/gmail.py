"""Gmail Deep Parser — reads flights, hotels, cabs, visas, payment confirmations."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from googleapiclient.discovery import build
from routers.auth import get_current_user, get_google_creds
from services.llm import llm_extract_trip_data
from models.schemas import ParsedEmail
from typing import List
import base64, re
from datetime import datetime, timedelta

router = APIRouter()

TRAVEL_KEYWORDS = [
    "booking confirmation", "flight confirmation", "hotel reservation",
    "your trip", "itinerary", "check-in", "boarding pass",
    "reservation confirmed", "cab booking", "payment receipt",
    "visa", "passport", "travel insurance", "airline", "airways",
    "indigo", "air india", "spicejet", "vistara", "goair",
    "makemytrip", "goibibo", "cleartrip", "yatra", "oyo", "booking.com",
    "airbnb", "uber receipt", "ola receipt", "rapido", "irctc",
]


def decode_email_body(payload: dict) -> str:
    """Recursively extract text from Gmail payload."""
    body = ""
    if "parts" in payload:
        for part in payload["parts"]:
            body += decode_email_body(part)
    elif payload.get("mimeType") in ("text/plain", "text/html"):
        data = payload.get("body", {}).get("data", "")
        if data:
            decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
            # Strip HTML tags
            decoded = re.sub(r"<[^>]+>", " ", decoded)
            body += decoded
    return body


@router.get("/parse-trips", response_model=List[ParsedEmail])
async def parse_gmail_trips(
    days_back: int = 90,
    current_user: dict = Depends(get_current_user)
):
    """
    Scan Gmail for travel emails and extract structured trip data.
    Only reads emails — never modifies or sends anything.
    """
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("gmail", "v1", credentials=creds)

    # Build search query
    since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y/%m/%d")
    keyword_query = " OR ".join([f'"{kw}"' for kw in TRAVEL_KEYWORDS[:12]])
    query = f"({keyword_query}) after:{since}"

    try:
        results = service.users().messages().list(
            userId="me", q=query, maxResults=50
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gmail API error: {str(e)}")

    messages = results.get("messages", [])
    parsed_list = []

    for msg_ref in messages[:30]:  # cap at 30
        try:
            msg = service.users().messages().get(
                userId="me", id=msg_ref["id"], format="full"
            ).execute()

            headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
            subject = headers.get("Subject", "")
            body = decode_email_body(msg["payload"])[:3000]  # limit tokens

            # Use LLM to extract structured data
            extracted = await llm_extract_trip_data(
                subject=subject,
                body=body,
                message_id=msg_ref["id"]
            )
            if extracted:
                parsed_list.append(extracted)
        except Exception:
            continue

    return parsed_list


@router.get("/budget-emails")
async def extract_budget_from_emails(
    current_user: dict = Depends(get_current_user)
):
    """Extract payment/expense emails to track trip budget."""
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("gmail", "v1", credentials=creds)

    since = (datetime.utcnow() - timedelta(days=30)).strftime("%Y/%m/%d")
    query = f'(payment OR receipt OR "amount paid" OR "transaction" OR "debited") after:{since}'

    results = service.users().messages().list(userId="me", q=query, maxResults=20).execute()
    messages = results.get("messages", [])

    expenses = []
    for msg_ref in messages[:15]:
        try:
            msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
            headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
            subject = headers.get("Subject", "")
            body = decode_email_body(msg["payload"])[:1500]

            # Quick regex for amounts
            amounts = re.findall(r'(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', body)
            if amounts:
                amount = float(amounts[0].replace(",", ""))
                expenses.append({
                    "subject": subject,
                    "amount": amount,
                    "currency": "INR",
                    "raw": body[:200]
                })
        except Exception:
            continue

    total_spent = sum(e["amount"] for e in expenses)
    return {"expenses": expenses, "total_spent": total_spent, "currency": "INR"}


@router.get("/visa-passport")
async def check_visa_expiry(current_user: dict = Depends(get_current_user)):
    """Scan for visa/passport documents and check expiry dates."""
    user_id = current_user["sub"]
    creds = get_google_creds(user_id)
    service = build("gmail", "v1", credentials=creds)

    query = 'subject:(visa OR passport OR "travel document") OR (visa expires OR visa validity)'
    results = service.users().messages().list(userId="me", q=query, maxResults=10).execute()
    messages = results.get("messages", [])

    docs = []
    for msg_ref in messages[:5]:
        try:
            msg = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
            headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
            body = decode_email_body(msg["payload"])[:2000]

            # Look for dates near "expiry", "valid until", etc.
            expiry_patterns = [
                r'(?:expiry|expires?|valid until|validity)[:\s]+(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})',
                r'(\d{1,2}/\d{1,2}/\d{4})',
            ]
            found_dates = []
            for pat in expiry_patterns:
                found_dates.extend(re.findall(pat, body, re.IGNORECASE))

            docs.append({
                "subject": headers.get("Subject", ""),
                "possible_expiry_dates": found_dates[:3],
                "snippet": body[:200],
            })
        except Exception:
            continue

    return {"visa_docs": docs}
