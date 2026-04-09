from __future__ import annotations

import time
from math import asin, cos, radians, sin, sqrt
from typing import Dict, List, Optional, Tuple

import requests


class AlertFeedService:
    USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
    EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

    def __init__(self) -> None:
        self._cache: tuple[float, List[Dict[str, object]]] | None = None

    def get_nearby_alerts(self, lat: float, lon: float, max_distance_km: float = 600.0) -> List[Dict[str, object]]:
        if self._cache and time.time() - self._cache[0] < 600:
            return self._filter_by_distance(self._cache[1], lat, lon, max_distance_km)

        alerts = []
        alerts.extend(self._fetch_usgs())
        alerts.extend(self._fetch_eonet())

        self._cache = (time.time(), alerts)
        return self._filter_by_distance(alerts, lat, lon, max_distance_km)

    def _fetch_usgs(self) -> List[Dict[str, object]]:
        try:
            response = requests.get(self.USGS_URL, timeout=4)
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        alerts: List[Dict[str, object]] = []
        for feature in payload.get("features", []):
            coords = feature.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            lon = float(coords[0])
            lat = float(coords[1])
            properties = feature.get("properties", {}) or {}
            magnitude = properties.get("mag")
            title = properties.get("title") or "USGS Earthquake"
            url = properties.get("url")
            severity = self._severity_from_magnitude(magnitude)

            alerts.append(
                {
                    "source": "USGS",
                    "type": "Earthquake",
                    "title": title,
                    "severity": severity,
                    "distance_km": None,
                    "url": url,
                    "_lat": lat,
                    "_lon": lon,
                }
            )
        return alerts

    def _fetch_eonet(self) -> List[Dict[str, object]]:
        try:
            params = {
                "status": "open",
                "category": "severeStorms,floods,volcanoes,wildfires,landslides",
                "limit": 60,
            }
            response = requests.get(self.EONET_URL, params=params, timeout=4)
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        alerts: List[Dict[str, object]] = []
        for event in payload.get("events", []):
            categories = event.get("categories", [])
            category_title = categories[0]["title"] if categories else "Event"
            hazard_type = self._map_eonet_category(category_title) or "Alert"
            geometry = event.get("geometry", [])
            if not geometry:
                continue
            latest = geometry[-1]
            coordinates = latest.get("coordinates", [])
            if len(coordinates) < 2:
                continue
            event_lon = float(coordinates[0])
            event_lat = float(coordinates[1])
            sources = event.get("sources", [])
            link = sources[0].get("url") if sources else None
            severity = self._severity_from_eonet(category_title)
            title = event.get("title") or category_title
            alerts.append(
                {
                    "source": "NASA EONET",
                    "type": hazard_type,
                    "title": title,
                    "severity": severity,
                    "distance_km": None,
                    "url": link,
                    "_lat": event_lat,
                    "_lon": event_lon,
                }
            )
        return alerts

    def _severity_from_magnitude(self, magnitude: object) -> str:
        try:
            mag = float(magnitude)
        except (TypeError, ValueError):
            return "INFO"
        if mag >= 6.0:
            return "HIGH"
        if mag >= 5.0:
            return "MODERATE"
        return "INFO"

    def _severity_from_eonet(self, category_title: str) -> str:
        normalized = category_title.lower()
        if "volcano" in normalized or "severe" in normalized:
            return "HIGH"
        if "flood" in normalized or "wildfire" in normalized or "landslide" in normalized:
            return "MODERATE"
        return "INFO"

    def _map_eonet_category(self, category_title: str) -> Optional[str]:
        normalized = category_title.lower()
        if "severe" in normalized:
            return "Severe Storm"
        if "flood" in normalized:
            return "Flood"
        if "volcano" in normalized:
            return "Volcano"
        if "wildfire" in normalized:
            return "Wildfire"
        if "landslide" in normalized:
            return "Landslide"
        return None

    def _centroid_from_geometry(self, geometry: object) -> Optional[Tuple[float, float]]:
        if not isinstance(geometry, dict):
            return None
        coords = geometry.get("coordinates")
        if not coords:
            return None

        points: List[Tuple[float, float]] = []
        self._flatten_coords(coords, points)
        if not points:
            return None

        min_lng = min(point[0] for point in points)
        max_lng = max(point[0] for point in points)
        min_lat = min(point[1] for point in points)
        max_lat = max(point[1] for point in points)
        return ((min_lat + max_lat) / 2, (min_lng + max_lng) / 2)

    def _flatten_coords(self, coords: object, bucket: List[Tuple[float, float]]) -> None:
        if not isinstance(coords, list):
            return
        if coords and isinstance(coords[0], (int, float)) and len(coords) >= 2:
            bucket.append((float(coords[0]), float(coords[1])))
            return
        for entry in coords:
            self._flatten_coords(entry, bucket)

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

    def _filter_by_distance(
        self,
        alerts: List[Dict[str, object]],
        lat: float,
        lon: float,
        max_distance_km: float,
    ) -> List[Dict[str, object]]:
        filtered: List[Dict[str, object]] = []
        for alert in alerts:
            event_lat = alert.get("_lat")
            event_lon = alert.get("_lon")
            distance_km = alert.get("distance_km")
            if event_lat is None or event_lon is None:
                continue
            distance_km = round(self._haversine_km(lat, lon, float(event_lat), float(event_lon)), 1)
            if distance_km > max_distance_km:
                continue
            filtered.append({**alert, "distance_km": distance_km})
        return filtered[:5]
