from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


ScenarioMode = Literal["live", "historical", "mock"]
RiskStatus = Literal["STABLE", "MODERATE", "CRITICAL"]


class SimulationRequest(BaseModel):
    location: str = Field(..., min_length=2, description="City or district name")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    scenario_mode: ScenarioMode = Field(default="live")
    historical_event_id: Optional[str] = None
    population: int = Field(default=20000, ge=1000, le=3000000)
    blocked_road_ids: List[str] = Field(default_factory=list)
    search_radius_km: int = Field(default=8, ge=1, le=30)
    incident_label: Optional[str] = None
    target_language: str = Field(default="en", min_length=2, max_length=8)
    include_public_alerts: bool = True
    include_satellite_events: bool = True


class WeatherSnapshot(BaseModel):
    temperature_c: float
    wind_speed_kmh: float
    precipitation_mm: float
    weather_code: int
    description: str
    source: str
    observed_at: str


class FloodSnapshot(BaseModel):
    river_discharge: float
    level: Literal["LOW", "MODERATE", "HIGH"]
    trend: str
    source: str
    observed_at: str


class SituationReport(BaseModel):
    location: str
    coordinates: Dict[str, float]
    risk_score: int
    status: RiskStatus
    hazards: List[str]
    weather_context: WeatherSnapshot
    flood_context: FloodSnapshot
    rationale: List[str]


class ResourceItem(BaseModel):
    type: str
    count: int
    priority: Literal["LOW", "MEDIUM", "HIGH"]
    reason: str


class FacilityItem(BaseModel):
    id: str
    name: str
    category: str
    coordinates: Dict[str, float]
    distance_km: float
    source: str


class RoutePlan(BaseModel):
    id: str
    destination_name: str
    destination_category: str
    destination_coordinates: Dict[str, float]
    path_summary: str
    distance_km: float
    eta_min: int
    traffic_delay_min: int
    source: str
    blocked_segments: List[str]


class OfficialAlert(BaseModel):
    source: str
    title: str
    severity: str
    distance_km: Optional[float] = None
    url: Optional[str] = None


class SatelliteEvent(BaseModel):
    source: str
    title: str
    category: str
    distance_km: Optional[float] = None
    url: Optional[str] = None


class AgentThought(BaseModel):
    agent: str
    summary: str
    details: List[str]


class SimulationResponse(BaseModel):
    simulation_id: str
    generated_at: str
    input: Dict[str, object]
    situation: SituationReport
    resources: List[ResourceItem]
    facilities: List[FacilityItem]
    routes: List[RoutePlan]
    official_alerts: List[OfficialAlert]
    satellite_events: List[SatelliteEvent]
    recommended_actions: List[str]
    agent_thoughts: List[AgentThought]
    meta: Dict[str, object]
