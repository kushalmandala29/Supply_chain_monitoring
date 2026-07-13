from celery import Celery

from beat_schedule import build_beat_schedule
from config import get_settings

settings = get_settings()

app = Celery("etl", broker=settings.redis_url, backend=settings.redis_url)
app.conf.timezone = "UTC"
app.conf.beat_schedule = build_beat_schedule()

# Import task modules so they register with `app` (Celery Beat/worker load
# this module by name, so relying on autodiscovery packaging isn't needed).
import tasks.news  # noqa: E402,F401
import tasks.weather  # noqa: E402,F401
import tasks.commodity  # noqa: E402,F401
import tasks.satellite  # noqa: E402,F401
