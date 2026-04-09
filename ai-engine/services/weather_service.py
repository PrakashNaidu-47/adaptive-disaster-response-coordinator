from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Dict, Optional

import requests

from data.historical_events import HISTORICAL_EVENTS


class WeatherService:
    OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
    OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

    def get_weather(
        self,
        lat: float,
        lon: float,
        scenario_mode: str = "live",
        historical_event_id: Optional[str] = None,
    ) -> Dict[str, object]:
        if scenario_mode == "historical":
            historical = self._historical_weather(historical_event_id)
            if historical is not None:
                return historical
            return self._fallback_snapshot("historical-fallback")

        if scenario_mode == "mock":
            return self._mock_snapshot()

        live = self._openweather_snapshot(lat, lon)
        if live is not None:
            return live

        try:
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,wind_speed_10m,precipitation,weather_code",
            }
            response = requests.get(self.OPEN_METEO_URL, params=params, timeout=3)
            response.raise_for_status()
            payload = response.json()
            current = payload.get("current", {})

            return {
                "temperature_c": float(current.get("temperature_2m", 26.0)),
                "wind_speed_kmh": float(current.get("wind_speed_10m", 18.0)),
                "precipitation_mm": float(current.get("precipitation", 0.0)),
                "weather_code": int(current.get("weather_code", 0)),
                "description": "Open-Meteo current conditions",
                "source": "open-meteo-live",
                "observed_at": current.get("time", self._now_iso()),
            }
        except Exception:
            return self._fallback_snapshot("live-fallback")

    def _historical_weather(self, event_id: Optional[str]) -> Optional[Dict[str, object]]:
        if not event_id:
            return None

        event = HISTORICAL_EVENTS.get(event_id)
        if not event:
            return None

        weather = event["weather"]
        return {
            "temperature_c": float(weather["temperature_c"]),
            "wind_speed_kmh": float(weather["wind_speed_kmh"]),
            "precipitation_mm": float(weather["precipitation_mm"]),
            "weather_code": int(weather["weather_code"]),
            "description": event.get("summary", "Historical weather profile"),
            "source": f"historical:{event_id}",
            "observed_at": self._now_iso(),
        }

    def _mock_snapshot(self) -> Dict[str, object]:
        return {
            "temperature_c": 29.0,
            "wind_speed_kmh": 44.0,
            "precipitation_mm": 16.0,
            "weather_code": 63,
            "description": "Synthetic rain and wind profile",
            "source": "mock",
            "observed_at": self._now_iso(),
        }

    def _fallback_snapshot(self, source: str) -> Dict[str, object]:
        return {
            "temperature_c": 27.0,
            "wind_speed_kmh": 28.0,
            "precipitation_mm": 8.0,
            "weather_code": 61,
            "description": "Fallback weather profile",
            "source": source,
            "observed_at": self._now_iso(),
        }

    def _openweather_snapshot(self, lat: float, lon: float) -> Dict[str, object] | None:
        api_key = os.getenv("OPENWEATHER_API_KEY")
        if not api_key:
            return None

        try:
            params = {
                "lat": lat,
                "lon": lon,
                "appid": api_key,
                "units": "metric",
            }
            response = requests.get(self.OPENWEATHER_URL, params=params, timeout=3)
            response.raise_for_status()
            payload = response.json()
            weather_items = payload.get("weather", [])
            weather_item = weather_items[0] if weather_items else {}
            rain = payload.get("rain", {})
            precipitation_mm = float(rain.get("1h", 0.0) or rain.get("3h", 0.0) or 0.0)

            return {
                "temperature_c": float(payload.get("main", {}).get("temp", 27.0)),
                "wind_speed_kmh": round(float(payload.get("wind", {}).get("speed", 0.0)) * 3.6, 2),
                "precipitation_mm": precipitation_mm,
                "weather_code": int(weather_item.get("id", 0)),
                "description": weather_item.get("description", "Live weather"),
                "source": "openweather-live",
                "observed_at": self._now_iso(),
            }
        except Exception:
            return None

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
