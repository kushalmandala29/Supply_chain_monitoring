"""Classifies a computed KPI value against config/settings.yaml's `kpi:`
section -- never a hardcoded number. Each KPI entry there declares
`direction` (higher_is_better | lower_is_better) plus green/amber/red bands,
so this module stays generic across all ten KPIs.
"""
from typing import Literal

from app.core.config import get_platform_config

Severity = Literal["green", "amber", "red"]


def _kpi_config(kpi_name: str) -> dict:
    return get_platform_config().get("kpi", {}).get(kpi_name, {})


def classify(kpi_name: str, value: float) -> Severity:
    cfg = _kpi_config(kpi_name)
    thresholds = cfg.get("thresholds", {})
    green, amber, red = thresholds.get("green"), thresholds.get("amber"), thresholds.get("red")
    if green is None or amber is None or red is None:
        return "green"

    if cfg.get("direction", "higher_is_better") == "higher_is_better":
        if value >= green:
            return "green"
        if value >= amber:
            return "amber"
        return "red"

    # lower_is_better: bands are ascending (green < amber < red)
    if value <= green:
        return "green"
    if value <= amber:
        return "amber"
    return "red"


def should_alert(kpi_name: str, value: float) -> bool:
    cfg = _kpi_config(kpi_name)
    if not cfg.get("alert", False):
        return False
    return classify(kpi_name, value) != "green"


def alert_severity(kpi_name: str, value: float) -> Severity:
    """Alias kept distinct from classify() for readability at call sites
    that only care about alerting, not the raw color band."""
    return classify(kpi_name, value)


def threshold_for(kpi_name: str) -> float | None:
    """The single threshold value that separates 'healthy' from 'breached',
    used by Neo4j graph queries (e.g. 'warehouses below threshold')."""
    cfg = _kpi_config(kpi_name)
    thresholds = cfg.get("thresholds", {})
    if cfg.get("direction", "higher_is_better") == "higher_is_better":
        return thresholds.get("amber")
    return thresholds.get("amber")
