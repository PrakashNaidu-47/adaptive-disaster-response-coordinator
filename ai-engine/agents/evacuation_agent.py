from __future__ import annotations

from typing import Dict, List

from routing.evacuation_routes import RouteFinder


class EvacuationAgent:
    def __init__(self) -> None:
        self.router = RouteFinder()

    def plan_routes(
        self,
        current_lat: float,
        current_lon: float,
        blocked_road_ids: List[str],
        facilities: List[Dict[str, object]],
    ) -> List[Dict[str, object]]:
        candidate_destinations = [
            item
            for item in facilities
            if item["category"] in {"shelter", "school", "community_centre", "hospital"}
        ]
        if not candidate_destinations:
            candidate_destinations = facilities[:3]

        deduplicated_destinations: List[Dict[str, object]] = []
        seen_names = set()
        for item in candidate_destinations:
            key = f"{item['name'].strip().lower()}::{item['category']}"
            if key in seen_names:
                continue
            seen_names.add(key)
            deduplicated_destinations.append(item)

        routes = self.router.find_live_routes(
            start_coords={"lat": current_lat, "lon": current_lon},
            destinations=deduplicated_destinations,
            blocked_road_ids=blocked_road_ids,
        )
        return routes
