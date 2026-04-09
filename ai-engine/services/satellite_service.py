from __future__ import annotations

import time
from math import asin, cos, radians, sin, sqrt
from typing import Dict, List

import requests


class SatelliteService:
    BASE_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

    def __init__(self) -> None:
        self._cache: tuple[float, List[Dict[str, object]]] | None = None

    def get_nearby_events(self, lat: float, lon: float, max_distance_km: float = 700.0) -> List[Dict[str, object]]:
        if self._cache and time.time() - self._cache[0] < 600:
            return self._filter_by_distance(self._cache[1], lat, lon, max_distance_km)

        try:
            params = {
                "status": "open",
                "category": "severeStorms,floods",
                "limit": 20,
            }
            response = requests.get(self.BASE_URL, params=params, timeout=4)
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        events: List[Dict[str, object]] = []
        for event in payload.get("events", []):
            title = event.get("title", "NASA EONET Event")
            categories = event.get("categories", [])
            category = categories[0]["title"] if categories else "Event"
            link = None
            sources = event.get("sources", [])
            if sources:
                link = sources[0].get("url")

            geometry = event.get("geometry", [])
            if not geometry:
                continue
            latest = geometry[-1]
            coordinates = latest.get("coordinates", [])
            if len(coordinates) < 2:
                continue

            event_lon = float(coordinates[0])
            event_lat = float(coordinates[1])
            distance_km = round(self._haversine_km(lat, lon, event_lat, event_lon), 1)
            if distance_km > max_distance_km:
                continue

            events.append(
                {
                    "source": "NASA EONET",
                    "title": title,
                    "category": category,
                    "distance_km": distance_km,
                    "url": link,
                    "_lat": event_lat,
                    "_lon": event_lon,
                }
            )

        self._cache = (time.time(), events)
        return events[:5]

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
        events: List[Dict[str, object]],
        lat: float,
        lon: float,
        max_distance_km: float,
    ) -> List[Dict[str, object]]:
        filtered: List[Dict[str, object]] = []
        for event in events:
            event_lat = event.get("_lat")
            event_lon = event.get("_lon")
            distance_km = event.get("distance_km")
            if event_lat is not None and event_lon is not None:
                distance_km = round(self._haversine_km(lat, lon, float(event_lat), float(event_lon)), 1)
            if distance_km is not None and distance_km > max_distance_km:
                continue
            filtered.append({**event, "distance_km": distance_km})
        return filtered[:5]
