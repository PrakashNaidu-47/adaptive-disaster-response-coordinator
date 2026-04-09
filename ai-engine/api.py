from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.coordinator import Coordinator
from data.historical_events import HISTORICAL_EVENTS
from models.simulation import SimulationRequest, SimulationResponse

app = FastAPI(
    title="Adaptive Disaster AI Engine",
    version="1.0.0",
    description="Multi-agent live operations service for disaster response planning.",
)
coordinator = Coordinator()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/historical-events")
def historical_events() -> dict[str, object]:
    events = []
    for event_id, payload in HISTORICAL_EVENTS.items():
        events.append(
            {
                "id": event_id,
                "title": payload["title"],
                "summary": payload["summary"],
            }
        )
    return {"events": events}


@app.post("/assess", response_model=SimulationResponse)
def assess_disaster(req: SimulationRequest) -> dict[str, object]:
    payload = req.model_dump()
    result = coordinator.run_simulation(payload)
    return result


@app.post("/simulate", response_model=SimulationResponse)
def simulate_disaster(req: SimulationRequest) -> dict[str, object]:
    payload = req.model_dump()
    result = coordinator.run_simulation(payload)
    return result
