from __future__ import annotations

from typing import Dict, Optional

from services.flood_service import FloodService
from services.location_service import LocationService
from services.weather_service import WeatherService


class SituationAgent:
    def __init__(self) -> None:
        self.weather_service = WeatherService()
        self.flood_service = FloodService()
        self.location_service = LocationService()

    def analyze(
        self,
        location_name: str,
        latitude: float | None = None,
        longitude: float | None = None,
        scenario_mode: str = "live",
        historical_event_id: Optional[str] = None,
    ) -> Dict[str, object]:
        normalized_location, lat, lon = self.location_service.resolve(
            location_name,
            latitude=latitude,
            longitude=longitude,
        )
        weather = self.weather_service.get_weather(
            lat=lat,
            lon=lon,
            scenario_mode=scenario_mode,
            historical_event_id=historical_event_id,
        )
        flood = self.flood_service.get_flood_context(lat=lat, lon=lon, scenario_mode=scenario_mode)

        risk_score = 10
        hazards = []
        rationale = []

        wind_speed = float(weather["wind_speed_kmh"])
        precipitation = float(weather["precipitation_mm"])
        temperature = float(weather["temperature_c"])
        river_discharge = float(flood["river_discharge"])

        if wind_speed >= 100:
            risk_score += 45
            hazards.append("Cyclonic winds")
            rationale.append("Wind speed exceeded 100 km/h, severe structural risk expected.")
        elif wind_speed >= 60:
            risk_score += 25
            hazards.append("Strong winds")
            rationale.append("Wind speed in high-risk range may affect transport and power lines.")
        elif wind_speed >= 35:
            risk_score += 12
            hazards.append("Windy conditions")
            rationale.append("Elevated wind speed can delay evacuation movements.")

        if precipitation >= 60:
            risk_score += 35
            hazards.append("Flash flood risk")
            rationale.append("Rainfall above 60 mm indicates likely flooding on low roads.")
        elif precipitation >= 25:
            risk_score += 18
            hazards.append("Urban flooding")
            rationale.append("Sustained rainfall may flood drainage-constrained areas.")
        elif precipitation >= 10:
            risk_score += 8
            hazards.append("Heavy rain")
            rationale.append("Rainfall could reduce visibility and route speed.")

        if flood["level"] == "HIGH":
            risk_score += 25
            hazards.append("River overflow risk")
            rationale.append(
                f"River discharge is elevated at {river_discharge:.1f} m3/s, indicating high flood pressure."
            )
        elif flood["level"] == "MODERATE":
            risk_score += 12
            hazards.append("Rising river levels")
            rationale.append(
                f"River discharge is elevated at {river_discharge:.1f} m3/s and should be watched closely."
            )

        if temperature >= 41:
            risk_score += 15
            hazards.append("Heat stress")
            rationale.append("High temperature increases responder fatigue and medical incidents.")

        risk_score = min(100, int(risk_score))

        if risk_score >= 70:
            status = "CRITICAL"
        elif risk_score >= 40:
            status = "MODERATE"
        else:
            status = "STABLE"

        if not hazards:
            hazards = ["No severe hazard detected"]
            rationale.append("Weather signals are within operational tolerance.")

        return {
            "location": normalized_location,
            "coordinates": {"lat": lat, "lon": lon},
            "risk_score": risk_score,
            "status": status,
            "hazards": hazards,
            "weather_context": weather,
            "flood_context": flood,
            "rationale": rationale,
        }
