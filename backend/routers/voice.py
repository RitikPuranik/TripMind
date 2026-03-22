"""Voice processing — Whisper STT, multilingual, code-switching support."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from routers.auth import get_current_user
from services.llm import llm_voice_response
from models.schemas import VoiceRequest, VoiceResponse
import httpx, os, tempfile

router = APIRouter()

# Language detection heuristics (supplemented by Whisper's auto-detection)
LANG_PATTERNS = {
    "hi": ["kya", "hai", "koi", "mujhe", "chahiye", "batao", "yahan", "wahan", "acha", "theek", "nahi", "haan"],
    "ta": ["enna", "ange", "inge", "vanakkam", "nandri", "seri"],
    "te": ["emi", "naaku", "meeru", "cheppandi", "bayalu"],
    "ml": ["enthu", "ente", "njan", "evide", "pokam"],
    "ar": ["marhaba", "shukran", "aywa", "wain", "kaif"],
}

def detect_language(text: str) -> str:
    """Simple language detection from text."""
    text_lower = text.lower()
    scores = {}
    for lang, words in LANG_PATTERNS.items():
        scores[lang] = sum(1 for w in words if w in text_lower)
    if max(scores.values(), default=0) > 0:
        best = max(scores, key=scores.get)
        if scores[best] > 0:
            return best
    return "en"


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Transcribe audio using OpenAI Whisper API.
    Supports 99 languages including Hindi, Tamil, Malayalam, Arabic, code-switching.
    """
    from utils.config import settings
    
    # Read uploaded audio
    audio_bytes = await audio.read()
    
    # Use Groq's Whisper endpoint (free tier, fastest)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                files={"file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm")},
                data={"model": "whisper-large-v3", "response_format": "json"},
            )
            r.raise_for_status()
            result = r.json()
            transcript = result.get("text", "")
            detected_lang = result.get("language", "en")
            return {"transcript": transcript, "detected_language": detected_lang}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/query", response_model=VoiceResponse)
async def process_voice_query(
    req: VoiceRequest,
    current_user: dict = Depends(get_current_user),
):
    """Process transcribed voice query and return multilingual AI response."""
    # Detect language if not provided
    lang = req.detected_language
    if lang == "en":
        detected = detect_language(req.transcript)
        if detected != "en":
            lang = detected

    context = req.context or {}
    city = context.get("city", "your location")

    result = await llm_voice_response(
        transcript=req.transcript,
        detected_lang=lang,
        context=context,
        city=city,
    )

    return VoiceResponse(
        reply=result.get("reply", ""),
        reply_language=result.get("reply_language", lang),
        action=result.get("action"),
    )


@router.post("/tts")
async def text_to_speech(
    text: str,
    language: str = "en",
    current_user: dict = Depends(get_current_user),
):
    """
    Text-to-speech using browser Web Speech API (frontend handles this).
    This endpoint provides language code mapping for frontend TTS.
    """
    lang_map = {
        "hi": "hi-IN", "en": "en-IN", "ta": "ta-IN", "te": "te-IN",
        "ml": "ml-IN", "kn": "kn-IN", "ar": "ar-SA", "fr": "fr-FR",
        "es": "es-ES", "de": "de-DE", "ja": "ja-JP", "zh": "zh-CN",
    }
    return {
        "text": text,
        "language_code": lang_map.get(language, "en-IN"),
        "voice_hint": "use_browser_tts",
    }
