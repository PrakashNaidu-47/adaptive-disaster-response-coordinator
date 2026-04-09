from __future__ import annotations

import time
from math import asin, cos, radians, sin, sqrt
from typing import Dict, List

import requests


class ResourceDiscoveryService:
    BASE_URL = "https://overpass-api.de/api/interpreter"

    def __init__(self) -> None:
        self._cache: Dict[str, tuple[float, List[Dict[str, object]]]] = {}

    def discover(self, lat: float, lon: float, radius_km: int = 8) -> List[Dict[str, object]]:
        cache_key = f"{round(lat, 3)}:{round(lon, 3)}:{radius_km}"
        cached = self._cache.get(cache_key)
        if cached and time.time() - cached[0] < 300:
            return cached[1]

        radius_m = radius_km * 1000
        query = f"""
[out:json][timeout:8];
(
  nwr["amenity"="hospital"](around:{radius_m},{lat},{lon});
  nwr["amenity"="clinic"](around:{radius_m},{lat},{lon});
  nwr["amenity"="fire_station"](around:{radius_m},{lat},{lon});
  nwr["amenity"="police"](around:{radius_m},{lat},{lon});
  nwr["amenity"="school"](around:{radius_m},{lat},{lon});
  nwr["amenity"="community_centre"](around:{radius_m},{lat},{lon});
  nwr["amenity"="shelter"](around:{radius_m},{lat},{lon});
  nwr["emergency"="ambulance_station"](around:{radius_m},{lat},{lon});
);
out center;
        """.strip()

        try:
            response = requests.post(
                self.BASE_URL,
                data=query.encode("utf-8"),
                headers={"Content-Type": "text/plain"},
                timeout=6,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        facilities: List[Dict[str, object]] = []
        for element in payload.get("elements", []):
            tags = element.get("tags", {})
            item_lat = element.get("lat")
            item_lon = element.get("lon")
            center = element.get("center", {})
            if item_lat is None:
                item_lat = center.get("lat")
            if item_lon is None:
                item_lon = center.get("lon")
            if item_lat is None or item_lon is None:
                continue

            category = self._category_from_tags(tags)
            if category is None:
                continue

            facilities.append(
                {
                    "id": f"{element.get('type', 'item')}-{element.get('id')}",
                    "name": tags.get("name") or f"Unnamed {category.replace('_', ' ')}",
                    "category": category,
                    "coordinates": {"lat": float(item_lat), "lon": float(item_lon)},
                    "distance_km": round(self._haversine_km(lat, lon, float(item_lat), float(item_lon)), 2),
                    "source": "OpenStreetMap Overpass",
                }
            )

        facilities.sort(key=lambda item: (item["distance_km"], item["name"]))
        limited = facilities[:20]
        self._cache[cache_key] = (time.time(), limited)
        return limited

    def _category_from_tags(self, tags: Dict[str, str]) -> str | None:
        amenity = tags.get("amenity")
        emergency = tags.get("emergency")
        if amenity in {"hospital", "clinic", "fire_station", "police", "school", "community_centre", "shelter"}:
            return amenity
        if emergency == "ambulance_station":
            return "ambulance_station"
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
