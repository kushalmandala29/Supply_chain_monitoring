"""Builds the Celery Beat schedule from config/settings.yaml (etl.*.interval_minutes)
so pipeline cadence is a config change, not a code change.
"""
from config import get_platform_config

_TASK_BY_PIPELINE = {
    "news": "tasks.news.run",
    "weather": "tasks.weather.run",
    "commodity": "tasks.commodity.run",
    "satellite": "tasks.satellite.run",
}


def build_beat_schedule() -> dict:
    etl_cfg = get_platform_config().get("etl", {})
    schedule = {}
    for pipeline_name, task_path in _TASK_BY_PIPELINE.items():
        interval_minutes = etl_cfg.get(pipeline_name, {}).get("interval_minutes")
        if interval_minutes is None:
            continue
        schedule[f"{pipeline_name}-etl"] = {
            "task": task_path,
            "schedule": interval_minutes * 60.0,
        }
    return schedule
