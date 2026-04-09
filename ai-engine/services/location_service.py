from __future__ import annotations

import os
import time
from typing import Dict, List, Tuple

import requests


_KNOWN_LOCATIONS: List[Dict[str, object]] = [
    {"name": "Visakhapatnam", "aliases": ["visakhapatnam", "vizag"], "lat": 17.6868, "lon": 83.2185},
    {"name": "Vijayawada", "aliases": ["vijayawada"], "lat": 16.5062, "lon": 80.6480},
    {"name": "Nellore", "aliases": ["nellore"], "lat": 14.4426, "lon": 79.9865},
    {"name": "Kurnool", "aliases": ["kurnool"], "lat": 15.8281, "lon": 78.0373},
    {"name": "Kadapa", "aliases": ["kadapa", "cuddapah"], "lat": 14.4673, "lon": 78.8242},
    {"name": "Anantapur", "aliases": ["anantapur"], "lat": 14.6819, "lon": 77.6006},
    {"name": "Tirupati", "aliases": ["tirupati"], "lat": 13.6288, "lon": 79.4192},
    {"name": "Kakinada", "aliases": ["kakinada"], "lat": 16.9891, "lon": 82.2475},
]


class LocationService:
    SEARCH_URL = "https://nominatim.openstreetmap.org/search"
    REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

    def __init__(self) -> None:
        self._cache: Dict[str, Tuple[str, float, float]] = {}
        self._last_request_ts = 0.0
        self._headers = {
            "User-Agent": os.getenv(
                "NOMINATIM_USER_AGENT",
                "adaptive-disaster-response/1.0 (contact: ops@example.com)",
            ),
        }

    def resolve(
        self,
        location_name: str,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> Tuple[str, float, float]:
        if latitude is not None and longitude is not None:
            if location_name and location_name.strip():
                label = location_name.strip()
            else:
                label = self._reverse_nominatim(latitude, longitude) or "Pinned Location"
            return label, float(latitude), float(longitude)

        if not location_name:
            return "Visakhapatnam", 17.6868, 83.2185

        normalized = location_name.strip().lower()
        if normalized in self._cache:
            return self._cache[normalized]

        for item in _KNOWN_LOCATIONS:
            aliases = item["aliases"]
            if normalized in aliases:
                resolved = (item["name"], float(item["lat"]), float(item["lon"]))
                self._cache[normalized] = resolved
                return resolved

        for item in _KNOWN_LOCATIONS:
            aliases = item["aliases"]
            if any(normalized in alias for alias in aliases):
                resolved = (item["name"], float(item["lat"]), float(item["lon"]))
                self._cache[normalized] = resolved
                return resolved

        geocoded = self._search_nominatim(location_name)
        if geocoded is not None:
            self._cache[normalized] = geocoded
            return geocoded

        fallback = (location_name.strip().title(), 17.6868, 83.2185)
        self._cache[normalized] = fallback
        return fallback

    def all_locations(self) -> List[Dict[str, object]]:
        return _KNOWN_LOCATIONS

    def _search_nominatim(self, location_name: str) -> Tuple[str, float, float] | None:
        self._throttle()
        params = {
            "q": location_name,
            "format": "jsonv2",
            "limit": 1,
            "countrycodes": "in",
        }

        email = os.getenv("NOMINATIM_CONTACT_EMAIL")
        if email:
            params["email"] = email

        try:
            response = requests.get(
                self.SEARCH_URL,
                params=params,
                headers=self._headers,
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload:
                return None
            item = payload[0]
            return (
                item.get("display_name", location_name.strip().title()),
                float(item["lat"]),
                float(item["lon"]),
            )
        except Exception:
            return None

    def _reverse_nominatim(self, latitude: float, longitude: float) -> str | None:
        self._throttle()
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
        }

        email = os.getenv("NOMINATIM_CONTACT_EMAIL")
        if email:
            params["email"] = email

        try:
            response = requests.get(
                self.REVERSE_URL,
                params=params,
                headers=self._headers,
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
            return payload.get("display_name")
        except Exception:
            return None

    def _throttle(self) -> None:
        now = time.time()
        elapsed = now - self._last_request_ts
        if elapsed < 1.05:
            time.sleep(1.05 - elapsed)
        self._last_request_ts = time.time()
