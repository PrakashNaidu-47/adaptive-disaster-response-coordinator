from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from math import asin, cos, radians, sin, sqrt
from typing import Dict, List, Optional

import networkx as nx
import requests


class RouteFinder:
    TOMTOM_URL = "https://api.tomtom.com/routing/1/calculateRoute"

    def __init__(self) -> None:
        self.graph = nx.Graph()
        self.shelter_nodes = {"SHELTER_NORTH", "SHELTER_CENTRAL", "SHELTER_SOUTH"}
        self._build_graph()

    def find_live_routes(
        self,
        start_coords: Dict[str, float],
        destinations: List[Dict[str, object]],
        blocked_road_ids: List[str],
    ) -> List[Dict[str, object]]:
        tomtom_key = os.getenv("TOMTOM_API_KEY")
        if not tomtom_key:
            return self._fallback_destination_routes(start_coords, destinations, blocked_road_ids)

        routes: List[Dict[str, object]] = []
        with ThreadPoolExecutor(max_workers=min(3, max(1, len(destinations[:3])))) as executor:
            futures = [
                executor.submit(
                    self._calculate_tomtom_route,
                    start_coords=start_coords,
                    destination=destination,
                    tomtom_key=tomtom_key,
                    blocked_road_ids=blocked_road_ids,
                )
                for destination in destinations[:3]
            ]
            for future in as_completed(futures):
                route = future.result()
                if route is not None:
                    routes.append(route)

        if routes:
            routes.sort(key=lambda item: (item["eta_min"], item["traffic_delay_min"]))
            return routes

        return self._fallback_destination_routes(start_coords, destinations, blocked_road_ids)

    def nearest_node(self, lat: float, lon: float) -> str:
        best_node = "CITY_CORE"
        best_distance = float("inf")
        for node, payload in self.graph.nodes(data=True):
            node_lat = payload["lat"]
            node_lon = payload["lon"]
            distance = sqrt((lat - node_lat) ** 2 + (lon - node_lon) ** 2)
            if distance < best_distance:
                best_distance = distance
                best_node = node
        return best_node

    def find_routes(
        self,
        start_node: str,
        blocked_road_ids: List[str],
        max_routes: int = 3,
    ) -> List[Dict[str, object]]:
        routes: List[Dict[str, object]] = []
        for shelter in self.shelter_nodes:
            route = self._route_to_shelter(start_node, shelter, blocked_road_ids)
            if route:
                routes.append(route)

        routes.sort(key=lambda item: (item["eta_min"], item["traffic_delay_min"]))
        return routes[:max_routes]

    def _calculate_tomtom_route(
        self,
        start_coords: Dict[str, float],
        destination: Dict[str, object],
        tomtom_key: str,
        blocked_road_ids: List[str],
    ) -> Optional[Dict[str, object]]:
        dest_coords = destination["coordinates"]
        url = (
            f"{self.TOMTOM_URL}/"
            f"{start_coords['lat']},{start_coords['lon']}:"
            f"{dest_coords['lat']},{dest_coords['lon']}/json"
        )
        params = {
            "key": tomtom_key,
            "traffic": "true",
            "travelMode": "car",
            "routeType": "fastest",
        }

        try:
            response = requests.get(url, params=params, timeout=4)
            response.raise_for_status()
            payload = response.json()
            route = payload.get("routes", [])[0]
            summary = route.get("summary", {})
            return {
                "id": destination["id"],
                "destination_name": destination["name"],
                "destination_category": destination["category"],
                "destination_coordinates": dest_coords,
                "path_summary": f"{destination['name']} via TomTom live traffic route",
                "distance_km": round(float(summary.get("lengthInMeters", 0.0)) / 1000, 2),
                "eta_min": max(1, round(float(summary.get("travelTimeInSeconds", 0.0)) / 60)),
                "traffic_delay_min": max(
                    0, round(float(summary.get("trafficDelayInSeconds", 0.0)) / 60)
                ),
                "source": "TomTom Routing API",
                "blocked_segments": blocked_road_ids,
            }
        except Exception:
            return None

    def _fallback_graph_routes(
        self,
        start_coords: Dict[str, float],
        blocked_road_ids: List[str],
    ) -> List[Dict[str, object]]:
        start_node = self.nearest_node(float(start_coords["lat"]), float(start_coords["lon"]))
        return self.find_routes(start_node, blocked_road_ids)

    def _fallback_destination_routes(
        self,
        start_coords: Dict[str, float],
        destinations: List[Dict[str, object]],
        blocked_road_ids: List[str],
    ) -> List[Dict[str, object]]:
        if not destinations:
            return self._fallback_graph_routes(start_coords, blocked_road_ids)

        routes: List[Dict[str, object]] = []
        for destination in destinations[:3]:
            dest_coords = destination["coordinates"]
            straight_line_km = self._haversine_km(
                float(start_coords["lat"]),
                float(start_coords["lon"]),
                float(dest_coords["lat"]),
                float(dest_coords["lon"]),
            )
            road_distance_km = round(max(straight_line_km * 1.2, 0.8), 2)
            eta_min = max(3, round((road_distance_km / 24.0) * 60))
            routes.append(
                {
                    "id": destination["id"],
                    "destination_name": destination["name"],
                    "destination_category": destination["category"],
                    "destination_coordinates": dest_coords,
                    "path_summary": f"Approximate evacuation corridor to {destination['name']}",
                    "distance_km": road_distance_km,
                    "eta_min": eta_min,
                    "traffic_delay_min": 0,
                    "source": "Approximate local facility route",
                    "blocked_segments": [],
                }
            )

        routes.sort(key=lambda item: item["distance_km"])
        return routes

    def _route_to_shelter(
        self,
        start_node: str,
        shelter_node: str,
        blocked_road_ids: List[str],
    ) -> Optional[Dict[str, object]]:
        graph = self.graph.copy()
        for edge_id in blocked_road_ids:
            road = self._find_edge_by_road_id(edge_id)
            if road and graph.has_edge(road["source"], road["target"]):
                graph.remove_edge(road["source"], road["target"])

        if not graph.has_node(start_node) or not graph.has_node(shelter_node):
            return None

        try:
            path_nodes = nx.shortest_path(
                graph,
                source=start_node,
                target=shelter_node,
                weight="travel_cost",
            )
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

        distance_km = 0.0
        used_roads: List[str] = []

        for idx in range(len(path_nodes) - 1):
            source = path_nodes[idx]
            target = path_nodes[idx + 1]
            edge = graph.get_edge_data(source, target)
            if not edge:
                continue
            distance_km += float(edge["distance_km"])
            used_roads.append(edge["road_id"])

        eta_min = int(round((distance_km / 32.0) * 60))

        return {
            "id": f"{shelter_node.lower()}",
            "destination_name": graph.nodes[shelter_node]["label"],
            "destination_category": "fallback_shelter",
            "destination_coordinates": {
                "lat": graph.nodes[shelter_node]["lat"],
                "lon": graph.nodes[shelter_node]["lon"],
            },
            "path_summary": " -> ".join(path_nodes),
            "distance_km": round(distance_km, 2),
            "eta_min": max(eta_min, 5),
            "traffic_delay_min": 0,
            "source": "Fallback graph router",
            "blocked_segments": [road for road in blocked_road_ids if road in used_roads],
        }

    def _build_graph(self) -> None:
        nodes = [
            ("CITY_CORE", {"label": "City Core", "lat": 16.50, "lon": 80.65}),
            ("RIVER_BELT", {"label": "River Belt", "lat": 16.53, "lon": 80.64}),
            ("HILL_EDGE", {"label": "Hill Edge", "lat": 16.47, "lon": 80.62}),
            ("PORT_ROAD", {"label": "Port Road", "lat": 16.54, "lon": 80.68}),
            ("HIGHWAY_JN", {"label": "Highway Junction", "lat": 16.49, "lon": 80.69}),
            ("SHELTER_NORTH", {"label": "North Relief Camp", "lat": 16.56, "lon": 80.66}),
            ("SHELTER_CENTRAL", {"label": "Central School Shelter", "lat": 16.51, "lon": 80.63}),
            ("SHELTER_SOUTH", {"label": "South Stadium Shelter", "lat": 16.45, "lon": 80.67}),
        ]
        self.graph.add_nodes_from(nodes)

        roads = [
            ("R1", "CITY_CORE", "RIVER_BELT", 3.1, 0.3),
            ("R2", "CITY_CORE", "HILL_EDGE", 2.8, 0.1),
            ("R3", "CITY_CORE", "PORT_ROAD", 3.4, 0.4),
            ("R4", "RIVER_BELT", "PORT_ROAD", 2.2, 0.6),
            ("R5", "RIVER_BELT", "SHELTER_NORTH", 2.4, 0.5),
            ("R6", "PORT_ROAD", "SHELTER_NORTH", 2.8, 0.3),
            ("R7", "HILL_EDGE", "SHELTER_CENTRAL", 2.0, 0.1),
            ("R8", "CITY_CORE", "SHELTER_CENTRAL", 2.3, 0.2),
            ("R9", "HILL_EDGE", "HIGHWAY_JN", 2.7, 0.2),
            ("R10", "HIGHWAY_JN", "SHELTER_SOUTH", 2.6, 0.2),
            ("R11", "CITY_CORE", "HIGHWAY_JN", 2.9, 0.4),
            ("R12", "SHELTER_CENTRAL", "SHELTER_SOUTH", 3.0, 0.3),
        ]

        for road_id, source, target, distance_km, flood_risk in roads:
            travel_cost = distance_km * (1 + flood_risk)
            self.graph.add_edge(
                source,
                target,
                road_id=road_id,
                distance_km=distance_km,
                flood_risk=flood_risk,
                travel_cost=travel_cost,
            )

    def _find_edge_by_road_id(self, road_id: str) -> Optional[Dict[str, str]]:
        for source, target, payload in self.graph.edges(data=True):
            if payload["road_id"] == road_id:
                return {"source": source, "target": target}
        return None

    def _haversine_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        lat1_r = radians(lat1)
        lon1_r = radians(lon1)
        lat2_r = radians(lat2)
        lon2_r = radians(lon2)
        dlat = lat2_r - lat1_r
        dlon = lon2_r - lon1_r
        a = sin(dlat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(dlon / 2) ** 2
        return 2 * radius_km * asin(sqrt(a))
