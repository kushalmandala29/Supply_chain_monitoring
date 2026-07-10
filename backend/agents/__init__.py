# Backend Agents Package
"""
Specialized Agent Swarm — 8 nodes mapped to their designated LLM providers.
Each agent operates on the shared SwarmState and has specific tool permissions.
"""

from backend.agents.supervisor import supervisor_node
from backend.agents.intelligence import intelligence_node
from backend.agents.vision import vision_node
from backend.agents.spatial import spatial_node
from backend.agents.geopolitical import geopolitical_node
from backend.agents.logistics import logistics_node
from backend.agents.finance import finance_node
from backend.agents.synthesis import synthesis_node

__all__ = [
    "supervisor_node",
    "intelligence_node",
    "vision_node",
    "spatial_node",
    "geopolitical_node",
    "logistics_node",
    "finance_node",
    "synthesis_node",
]
