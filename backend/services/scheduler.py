"""Background scheduler — runs all proactive triggers every few minutes."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def check_weather_triggers():
    """Runs every 15 min — check rain/heat alerts for active users."""
    # In production: iterate active user sessions from DB
    logger.debug("Weather trigger check running")


async def check_meal_triggers():
    """Runs at 11:55 and 18:55 — push meal suggestions."""
    logger.debug("Meal trigger check running")


async def check_flight_triggers():
    """Runs every 10 min — check gate changes for flights today."""
    logger.debug("Flight trigger check running")


async def check_currency_triggers():
    """Runs every 6 hours — check exchange rate movements."""
    logger.debug("Currency trigger check running")


async def send_weekly_digest():
    """Runs Monday 8am — send weekly WhatsApp digest."""
    logger.debug("Weekly digest running")


async def start_scheduler():
    scheduler.add_job(check_weather_triggers, IntervalTrigger(minutes=15), id="weather")
    scheduler.add_job(check_meal_triggers, CronTrigger(hour="11,18", minute=55), id="meals")
    scheduler.add_job(check_flight_triggers, IntervalTrigger(minutes=10), id="flights")
    scheduler.add_job(check_currency_triggers, IntervalTrigger(hours=6), id="currency")
    scheduler.add_job(send_weekly_digest, CronTrigger(day_of_week="mon", hour=8), id="digest")
    scheduler.start()
    logger.info("Scheduler started with 5 jobs")


async def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
