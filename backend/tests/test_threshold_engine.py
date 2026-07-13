"""Threshold classification reads config/settings.yaml's `kpi:` section --
these tests exercise real KPI entries defined there (fill_rate,
days_on_hand) rather than mocking the config, since get_platform_config()
resolves config/settings.yaml by absolute repo path regardless of cwd."""
from app.services.kpi import threshold_engine


def test_classify_higher_is_better_green():
    assert threshold_engine.classify("fill_rate", 99) == "green"


def test_classify_higher_is_better_amber():
    assert threshold_engine.classify("fill_rate", 96) == "amber"


def test_classify_higher_is_better_red():
    assert threshold_engine.classify("fill_rate", 80) == "red"


def test_classify_lower_is_better_green():
    assert threshold_engine.classify("days_on_hand", 20) == "green"


def test_classify_lower_is_better_amber():
    assert threshold_engine.classify("days_on_hand", 40) == "amber"


def test_classify_lower_is_better_red():
    assert threshold_engine.classify("days_on_hand", 70) == "red"


def test_should_alert_true_when_breached():
    assert threshold_engine.should_alert("fill_rate", 80) is True


def test_should_alert_false_when_healthy():
    assert threshold_engine.should_alert("fill_rate", 99) is False


def test_threshold_for_returns_amber_band():
    assert threshold_engine.threshold_for("fill_rate") == 95


def test_unknown_kpi_defaults_to_green():
    assert threshold_engine.classify("not_a_real_kpi", 42) == "green"
