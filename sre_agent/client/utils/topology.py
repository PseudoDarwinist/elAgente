"""Service topology manager for context curation.

This module provides topology awareness for the SRE Agent, allowing it to
understand service dependencies and recommend related services to investigate
when diagnosing incidents.

For the hackathon, topology is hardcoded for the Aura Quiet Living e-commerce app.
In production, this could be populated from:
- Service mesh (Istio/Linkerd)
- Kubernetes labels/annotations
- Configuration files
- Auto-discovery via distributed tracing
"""

from __future__ import annotations

import logging

# Try to use shared logger (available in Docker), fallback to standard logging
try:
    from shared.logger import logger  # type: ignore[import-not-found]
except ImportError:
    logger = logging.getLogger(__name__)


# Aura E-commerce Topology (Hardcoded for Hackathon Demo)
# --------------------------------------------------------
# Architecture:
#   aura-frontend (React/Nginx:8080)
#        ↓
#   aura-backend (Express:4000)
#        ↓
#   [inventory-db, stripe] (simulated external services)
#
AURA_TOPOLOGY: dict[str, dict[str, list[str]]] = {
    "aura-backend": {
        "upstream": [],  # No upstream services it depends on
        "downstream": ["inventory-db", "stripe"],  # External services it calls
        "consumers": ["aura-frontend"],  # Services that call this one
    },
    "aura-frontend": {
        "upstream": ["aura-backend"],  # Depends on backend API
        "downstream": [],
        "consumers": [],  # End-user facing
    },
}


class TopologyManager:
    """Manages service dependency topology for context-aware diagnosis.
    
    The topology helps the SRE agent understand service relationships
    so it can guide the LLM to investigate related services when diagnosing
    an incident.
    
    Example usage:
        topology = TopologyManager()
        related = topology.get_related_services("aura-backend")
        # Returns: ["inventory-db", "stripe", "aura-frontend"]
    """

    def __init__(self, topology: dict[str, dict[str, list[str]]] | None = None) -> None:
        """Initialize the topology manager.
        
        Args:
            topology: Optional custom topology dict. Defaults to AURA_TOPOLOGY.
        """
        self._topology = topology or AURA_TOPOLOGY
        logger.info(f"TopologyManager initialized with {len(self._topology)} services")

    def get_service_info(self, service: str) -> dict[str, list[str]]:
        """Get topology information for a specific service.
        
        Args:
            service: The service name to look up.
            
        Returns:
            Dict with 'upstream', 'downstream', and 'consumers' lists.
            Returns empty lists if service not found.
        """
        return self._topology.get(service, {
            "upstream": [],
            "downstream": [],
            "consumers": [],
        })

    def get_related_services(self, service: str) -> list[str]:
        """Get all services related to the given service.
        
        This returns a combined list of:
        - Upstream dependencies (services this one depends on)
        - Downstream dependencies (services this one calls)
        - Consumers (services that call this one)
        
        Args:
            service: The primary service being diagnosed.
            
        Returns:
            List of related service names (deduplicated).
        """
        info = self.get_service_info(service)
        related: set[str] = set()
        related.update(info.get("upstream", []))
        related.update(info.get("downstream", []))
        related.update(info.get("consumers", []))
        
        # Remove the service itself if accidentally included
        related.discard(service)
        
        logger.debug(f"Related services for {service}: {list(related)}")
        return list(related)

    def get_topology_context(self, service: str) -> str:
        """Generate a human-readable topology context string for the LLM.
        
        This provides the LLM with information about service relationships
        to guide its investigation.
        
        Args:
            service: The primary service being diagnosed.
            
        Returns:
            A formatted string describing the service's relationships.
        """
        info = self.get_service_info(service)
        related = self.get_related_services(service)
        
        if not related:
            return f"Note: No known service dependencies for '{service}' in topology."
        
        lines = [f"## Service Topology for {service}"]
        
        if info.get("upstream"):
            lines.append(f"- **Depends on**: {', '.join(info['upstream'])}")
        if info.get("downstream"):
            lines.append(f"- **Calls**: {', '.join(info['downstream'])}")
        if info.get("consumers"):
            lines.append(f"- **Called by**: {', '.join(info['consumers'])}")
        
        lines.append("")
        lines.append(
            f"Consider querying logs from these related services if issues appear connected: "
            f"{', '.join(related)}"
        )
        
        return "\n".join(lines)

    def is_known_service(self, service: str) -> bool:
        """Check if a service exists in the topology.
        
        Args:
            service: Service name to check.
            
        Returns:
            True if the service is in the topology, False otherwise.
        """
        return service in self._topology
