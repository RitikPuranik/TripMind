"""SQLAlchemy models + Supabase client."""
from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON, Text, ForeignKey, Integer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from utils.config import settings

Base = declarative_base()

# ── Async engine ──────────────────────────────────────────────────────────────
def get_engine():
    url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgres://", "postgresql+asyncpg://")
    return create_async_engine(url, pool_size=10, max_overflow=20, echo=False)

engine = get_engine() if settings.DATABASE_URL else None
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None

async def get_db():
    if not AsyncSessionLocal:
        yield None
        return
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Models ────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String, unique=True, index=True, nullable=False)
    name           = Column(String)
    avatar_url     = Column(String)
    google_id      = Column(String, unique=True, index=True)
    google_tokens  = Column(JSON)        # encrypted access+refresh tokens
    created_at     = Column(DateTime, default=datetime.utcnow)
    last_active    = Column(DateTime, default=datetime.utcnow)

    preferences    = relationship("UserPreference", back_populates="user", uselist=False)
    trips          = relationship("Trip", back_populates="user")
    feedbacks      = relationship("Feedback", back_populates="user")


class UserPreference(Base):
    __tablename__ = "user_preferences"
    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    budget_level        = Column(String, default="mid-range")   # low / mid-range / high
    dietary             = Column(String, default="no restrictions")
    interests           = Column(JSON, default=list)
    trip_purpose        = Column(String, default="leisure")     # business / leisure
    language            = Column(String, default="en")
    notification_freq   = Column(String, default="normal")      # minimal / normal / high
    travel_mode         = Column(String, default="leisure")     # Business / Leisure
    home_city           = Column(String)
    whatsapp_number     = Column(String)
    embedding           = Column(JSON)   # preference vector (Sentence Transformers)
    updated_at          = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="preferences")


class Trip(Base):
    __tablename__ = "trips"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    destination     = Column(String, nullable=False)
    city            = Column(String)
    country         = Column(String)
    start_date      = Column(DateTime)
    end_date        = Column(DateTime)
    trip_type       = Column(String, default="general")   # flight / hotel / general
    budget_total    = Column(Float, default=0)
    budget_spent    = Column(Float, default=0)
    currency        = Column(String, default="INR")
    status          = Column(String, default="upcoming")  # upcoming / active / past
    source          = Column(String, default="gmail")     # gmail / manual / calendar
    raw_data        = Column(JSON)      # original email/calendar data
    itinerary       = Column(JSON)      # generated day-by-day plan
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="trips")
    expenses        = relationship("Expense", back_populates="trip")


class Expense(Base):
    __tablename__ = "expenses"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id     = Column(UUID(as_uuid=True), ForeignKey("trips.id"))
    amount      = Column(Float, nullable=False)
    currency    = Column(String, default="INR")
    category    = Column(String)        # food / transport / hotel / activity
    description = Column(String)
    source      = Column(String)        # gmail / manual
    date        = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="expenses")


class Suggestion(Base):
    __tablename__ = "suggestions"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name            = Column(String)
    place_type      = Column(String)
    emoji           = Column(String)
    address         = Column(String)
    lat             = Column(Float)
    lng             = Column(Float)
    distance_m      = Column(Integer)
    duration_mins   = Column(Integer)
    budget_min      = Column(Float)
    budget_max      = Column(Float)
    currency        = Column(String, default="INR")
    crowd_level     = Column(String)    # low / medium / high
    weather_ok      = Column(Boolean, default=True)
    score           = Column(Float)     # 0-1 composite score
    reason          = Column(Text)      # "Suggested because: ..."
    raw_data        = Column(JSON)
    created_at      = Column(DateTime, default=datetime.utcnow)

    feedbacks = relationship("Feedback", back_populates="suggestion")


class Feedback(Base):
    __tablename__ = "feedbacks"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    suggestion_id   = Column(UUID(as_uuid=True), ForeignKey("suggestions.id"), nullable=True)
    vote            = Column(String)    # up / down
    suggestion_type = Column(String)    # place_type for learning
    reason_tags     = Column(JSON)      # extracted preference signals
    created_at      = Column(DateTime, default=datetime.utcnow)

    user       = relationship("User", back_populates="feedbacks")
    suggestion = relationship("Suggestion", back_populates="feedbacks")


class Alert(Base):
    __tablename__ = "alerts"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    alert_type  = Column(String)    # weather / free_time / meal / gate_change / visa / currency / event
    title       = Column(String)
    body        = Column(Text)
    icon        = Column(String)
    read        = Column(Boolean, default=False)
    sent_via    = Column(String)    # push / whatsapp / in_app
    created_at  = Column(DateTime, default=datetime.utcnow)


class TripMemory(Base):
    __tablename__ = "trip_memories"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    trip_id         = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True)
    memory_type     = Column(String)    # loved_place / avoided / visited / expense
    content         = Column(JSON)
    embedding       = Column(JSON)      # vector for semantic retrieval
    created_at      = Column(DateTime, default=datetime.utcnow)
