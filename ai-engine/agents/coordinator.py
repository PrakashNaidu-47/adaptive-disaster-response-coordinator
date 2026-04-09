from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, List
from uuid import uuid4

from data.historical_events import HISTORICAL_EVENTS
from services.alert_feed_service import AlertFeedService
from services.resource_discovery_service import ResourceDiscoveryService
from services.satellite_service import SatelliteService

from .evacuation_agent import EvacuationAgent
from .resource_agent import ResourceAgent
from .situation_agent import SituationAgent


class Coordinator:
    def __init__(self) -> None:
        self.situation = SituationAgent()
        self.resource = ResourceAgent()
        self.evacuation = EvacuationAgent()
        self.alert_feed = AlertFeedService()
        self.resource_discovery = ResourceDiscoveryService()
        self.satellite = SatelliteService()

    def run_simulation(self, payload: Dict[str, object]) -> Dict[str, object]:
        location_name = str(payload.get("location", "Visakhapatnam"))
        scenario_mode = str(payload.get("scenario_mode", "live"))
        historical_event_id = payload.get("historical_event_id")
        population = int(payload.get("population", 20000))
        search_radius_km = int(payload.get("search_radius_km", 8))
        incident_label = payload.get("incident_label")
        target_language = str(payload.get("target_language", "en"))
        include_public_alerts = bool(payload.get("include_public_alerts", True))
        include_satellite_events = bool(payload.get("include_satellite_events", True))
        user_blocked_roads = [str(item) for item in payload.get("blocked_road_ids", [])]

        sit_report = self.situation.analyze(
            location_name=location_name,
            latitude=float(payload["latitude"]) if payload.get("latitude") is not None else None,
            longitude=float(payload["longitude"]) if payload.get("longitude") is not None else None,
            scenario_mode=scenario_mode,
            historical_event_id=str(historical_event_id) if historical_event_id else None,
        )
        coords = sit_report["coordinates"]

        with ThreadPoolExecutor(max_workers=3) as executor:
            facilities_future = executor.submit(
                self.resource_discovery.discover,
                lat=float(coords["lat"]),
                lon=float(coords["lon"]),
                radius_km=search_radius_km,
            )
            alerts_future = (
                executor.submit(
                    self.alert_feed.get_nearby_alerts,
                    lat=float(coords["lat"]),
                    lon=float(coords["lon"]),
                )
                if include_public_alerts
                else None
            )
            satellite_future = (
                executor.submit(
                    self.satellite.get_nearby_events,
                    lat=float(coords["lat"]),
                    lon=float(coords["lon"]),
                )
                if include_satellite_events
                else None
            )

            facilities = facilities_future.result()
            official_alerts = alerts_future.result() if alerts_future is not None else []
            satellite_events = satellite_future.result() if satellite_future is not None else []

        sit_report = self._apply_external_alerts(
            sit_report=sit_report,
            official_alerts=official_alerts,
            satellite_events=satellite_events,
        )

        blocked_roads = self._merge_blocked_roads(
            scenario_mode=scenario_mode,
            historical_event_id=str(historical_event_id) if historical_event_id else None,
            user_blocked_roads=user_blocked_roads,
            risk_status=sit_report["status"],
        )

        resources = self.resource.allocate(
            risk_level=str(sit_report["status"]),
            population=population,
            hazards=[str(item) for item in sit_report["hazards"]],
            facilities=facilities,
            flood_level=str(sit_report["flood_context"]["level"]),
        )
        routes = self.evacuation.plan_routes(
            current_lat=float(coords["lat"]),
            current_lon=float(coords["lon"]),
            blocked_road_ids=blocked_roads,
            facilities=facilities,
        )

        recommended_actions = self._build_recommended_actions(
            sit_report=sit_report,
            routes=routes,
            official_alerts=official_alerts,
        )
        thoughts = self._build_agent_thoughts(
            sit_report=sit_report,
            resources=resources,
            routes=routes,
            blocked_roads=blocked_roads,
            facilities=facilities,
            official_alerts=official_alerts,
        )

        simulation_id = str(uuid4())
        generated_at = datetime.now(timezone.utc).isoformat()

        return {
            "simulation_id": simulation_id,
            "generated_at": generated_at,
            "input": {
                "location": location_name,
                "latitude": payload.get("latitude"),
                "longitude": payload.get("longitude"),
                "scenario_mode": scenario_mode,
                "historical_event_id": historical_event_id,
                "population": population,
                "blocked_road_ids": blocked_roads,
                "search_radius_km": search_radius_km,
                "incident_label": incident_label,
                "target_language": target_language,
            },
            "situation": sit_report,
            "resources": resources,
            "facilities": facilities,
            "routes": routes,
            "official_alerts": official_alerts,
            "satellite_events": satellite_events,
            "recommended_actions": recommended_actions,
            "agent_thoughts": thoughts,
            "meta": {
                "scenario_mode": scenario_mode,
                "historical_event_title": self._historical_title(str(historical_event_id)) if historical_event_id else None,
                "data_quality": "high" if scenario_mode in {"live", "historical"} else "synthetic",
                "incident_label": incident_label or f"Live assessment for {sit_report['location']}",
            },
        }

    def _merge_blocked_roads(
        self,
        scenario_mode: str,
        historical_event_id: str | None,
        user_blocked_roads: List[str],
        risk_status: str,
    ) -> List[str]:
        blocked = set(user_blocked_roads)
        if scenario_mode == "historical" and historical_event_id in HISTORICAL_EVENTS:
            blocked.update(HISTORICAL_EVENTS[historical_event_id]["blocked_road_ids"])

        if risk_status == "CRITICAL":
            blocked.update({"R4"})
        elif risk_status == "MODERATE":
            blocked.update({"R11"})

        return sorted(blocked)

    def _historical_title(self, event_id: str) -> str | None:
        event = HISTORICAL_EVENTS.get(event_id)
        if not event:
            return None
        return str(event.get("title"))

    def _apply_external_alerts(
        self,
        sit_report: Dict[str, object],
        official_alerts: List[Dict[str, object]],
        satellite_events: List[Dict[str, object]],
    ) -> Dict[str, object]:
        if not official_alerts and not satellite_events:
            return sit_report

        risk_score = int(sit_report.get("risk_score", 0))
        hazards = [str(item) for item in sit_report.get("hazards", [])]
        rationale = [str(item) for item in sit_report.get("rationale", [])]

        def distance_factor(distance_km: object) -> float:
            try:
                distance = float(distance_km)
            except (TypeError, ValueError):
                return 1.0
            if distance <= 100:
                return 1.0
            if distance <= 300:
                return 0.7
            return 0.45

        alert_boost = 0
        alert_types = set()
        if official_alerts:
            severity_boost = {"HIGH": 45, "MODERATE": 25, "INFO": 12}
            for alert in official_alerts:
                severity = str(alert.get("severity", "INFO")).upper()
                base = severity_boost.get(severity, 12)
                boost = int(round(base * distance_factor(alert.get("distance_km"))))
                alert_boost = max(alert_boost, boost)
                alert_type = alert.get("type")
                if alert_type:
                    alert_types.add(str(alert_type))

            if alert_boost > 0:
                risk_score += alert_boost
                hazards.append("Official alerts nearby")
                rationale.append(
                    f"Nearby official alert feeds increased risk by {alert_boost} points."
                )

        satellite_boost = 0
        if satellite_events:
            for event in satellite_events:
                base = 20
                boost = int(round(base * distance_factor(event.get("distance_km"))))
                satellite_boost = max(satellite_boost, boost)

            if satellite_boost > 0:
                risk_score += satellite_boost
                hazards.append("Satellite-detected severe events nearby")
                rationale.append(
                    f"Satellite event detections increased risk by {satellite_boost} points."
                )

        if alert_types:
            for alert_type in sorted(alert_types):
                hazards.append(f"{alert_type} activity nearby")
            rationale.append(
                f"Detected hazard types from live feeds: {', '.join(sorted(alert_types))}."
            )

        if (alert_boost > 0 or satellite_boost > 0 or alert_types) and "No severe hazard detected" in hazards:
            hazards = [item for item in hazards if item != "No severe hazard detected"]

        risk_score = min(100, int(risk_score))
        if risk_score >= 70:
            status = "CRITICAL"
        elif risk_score >= 40:
            status = "MODERATE"
        else:
            status = "STABLE"

        sit_report["risk_score"] = risk_score
        sit_report["status"] = status
        sit_report["hazards"] = hazards
        sit_report["rationale"] = rationale
        return sit_report

    def _build_agent_thoughts(
        self,
        sit_report: Dict[str, object],
        resources: List[Dict[str, object]],
        routes: List[Dict[str, object]],
        blocked_roads: List[str],
        facilities: List[Dict[str, object]],
        official_alerts: List[Dict[str, object]],
    ) -> List[Dict[str, object]]:
        situation_details = [str(item) for item in sit_report["rationale"]]
        situation_details.append(f"Computed risk score = {sit_report['risk_score']}.")
        situation_details.append(
            f"Flood level={sit_report['flood_context']['level']} at {sit_report['flood_context']['river_discharge']} m3/s."
        )

        resource_details = [
            f"{item['type']} x{item['count']} ({item['priority']})" for item in resources
        ]
        resource_details.append(
            f"Allocation scaled for risk={sit_report['status']} and hazards={', '.join(sit_report['hazards'])}."
        )
        resource_details.append(f"Discovered {len(facilities)} nearby facilities via Overpass.")

        if routes:
            route_details = [
                f"{route['destination_name']} ({route['destination_category']}) in {route['eta_min']} min"
                for route in routes
            ]
        else:
            route_details = ["No valid route remained after blocked-road constraints."]
        route_details.append(f"Blocked road ids considered: {', '.join(blocked_roads) or 'none'}.")
        if official_alerts:
            route_details.append(f"Nearby official alerts found: {len(official_alerts)}.")

        return [
            {
                "agent": "SituationAgent",
                "summary": f"Detected {sit_report['status']} conditions for {sit_report['location']}.",
                "details": situation_details,
            },
            {
                "agent": "ResourceAgent",
                "summary": f"Prepared {len(resources)} resource allocations.",
                "details": resource_details,
            },
            {
                "agent": "EvacuationAgent",
                "summary": f"Generated {len(routes)} evacuation candidates.",
                "details": route_details,
            },
        ]

    def _build_recommended_actions(
        self,
        sit_report: Dict[str, object],
        routes: List[Dict[str, object]],
        official_alerts: List[Dict[str, object]],
    ) -> List[str]:
        actions = [
            f"Maintain live monitoring for {sit_report['location']} with status {sit_report['status']}.",
        ]

        if sit_report["status"] in {"MODERATE", "CRITICAL"}:
            actions.append("Activate district response room and validate field conditions with local officers.")
        if sit_report["flood_context"]["level"] in {"MODERATE", "HIGH"}:
            actions.append("Warn low-lying wards near rivers and drains about possible water rise.")
        if official_alerts:
            actions.append("Cross-check public warning feeds against state and district authorities before broadcast.")
        if routes:
            actions.append(
                f"Use {routes[0]['destination_name']} as the primary evacuation or staging destination."
            )
        return actions
