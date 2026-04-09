from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict

import requests


class FloodService:
    BASE_URL = "https://flood-api.open-meteo.com/v1/flood"

    def get_flood_context(self, lat: float, lon: float, scenario_mode: str = "live") -> Dict[str, object]:
        if scenario_mode == "mock":
            return self._fallback_snapshot("mock", 18.0)

        try:
            params = {
                "latitude": lat,
                "longitude": lon,
                "daily": "river_discharge",
                "forecast_days": 3,
            }
            response = requests.get(self.BASE_URL, params=params, timeout=3)
            response.raise_for_status()
            payload = response.json()
            daily = payload.get("daily", {})
            discharge_values = daily.get("river_discharge", [])
            timestamps = daily.get("time", [])

            if not discharge_values:
                return self._fallback_snapshot("open-meteo-flood-empty", 12.0)

            peak_discharge = max(float(value) for value in discharge_values if value is not None)
            observed_at = timestamps[0] if timestamps else self._now_iso()
            level = self._level_from_discharge(peak_discharge)
            trend = self._trend_from_series(discharge_values)

            return {
                "river_discharge": round(peak_discharge, 2),
                "level": level,
                "trend": trend,
                "source": "open-meteo-flood",
                "observed_at": observed_at,
            }
        except Exception:
            return self._fallback_snapshot("open-meteo-flood-fallback", 12.0)

    def _level_from_discharge(self, discharge: float) -> str:
        if discharge >= 45:
            return "HIGH"
        if discharge >= 20:
            return "MODERATE"
        return "LOW"

    def _trend_from_series(self, discharge_values: list[float]) -> str:
        numeric = [float(value) for value in discharge_values if value is not None]
        if len(numeric) < 2:
            return "stable"
        if numeric[-1] > numeric[0]:
            return "rising"
        if numeric[-1] < numeric[0]:
            return "falling"
        return "stable"

    def _fallback_snapshot(self, source: str, discharge: float) -> Dict[str, object]:
        return {
            "river_discharge": discharge,
            "level": self._level_from_discharge(discharge),
            "trend": "stable",
            "source": source,
            "observed_at": self._now_iso(),
        }

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
