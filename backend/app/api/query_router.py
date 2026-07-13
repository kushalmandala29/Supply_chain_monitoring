"""Lightweight intent classifier that decides which agents a query activates.

The intent -> keyword -> agent mapping lives entirely in config/settings.yaml
(query_router.intents). This module contains no hardcoded countries, suppliers,
ports, or other domain data -- only the mechanism for matching a query against
the configured intents.
"""
from app.core.config import get_platform_config
from app.models.query import RoutedQuery, UserQuery


def route_query(user_query: UserQuery) -> RoutedQuery:
    intents: dict = get_platform_config().get("query_router", {}).get("intents", {})
    text = user_query.query.lower()

    for intent_name, intent_cfg in intents.items():
        if intent_name == "default":
            continue
        keywords = intent_cfg.get("keywords", [])
        if any(keyword in text for keyword in keywords):
            return RoutedQuery(
                session_id=user_query.session_id,
                query=user_query.query,
                intent=intent_name,
                agents=intent_cfg.get("agents", []),
            )

    default_cfg = intents.get("default", {"agents": []})
    return RoutedQuery(
        session_id=user_query.session_id,
        query=user_query.query,
        intent="default",
        agents=default_cfg.get("agents", []),
    )
