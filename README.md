# Adaptive Disaster Response Coordinator (Python + MERN)

End-to-end implementation of your abstract:
- React dashboard (UI)
- Node/Express API gateway
- MongoDB persistence
- Python FastAPI multi-agent engine
- Graph-based evacuation routing and live/historical simulation modes
- Live hazard feeds (USGS + NASA EONET) with map + assessment sync
- Active Situation Report with risk scoring + hazard attribution

## 1. System Architecture

`React (frontend)` -> `Express API (backend)` -> `FastAPI AI Engine (python)`  
`Express API` -> `MongoDB` (stores simulation history)

Authentication:
`React login page` -> `Supabase Auth`
`Express API` -> verifies Supabase bearer token before serving protected routes

### Agent pipeline inside Python engine
1. `SituationAgent`: location + weather ingestion + risk scoring
2. `ResourceAgent`: dynamic response resource allocation
3. `EvacuationAgent`: NetworkX routing with blocked-road handling
4. `Coordinator`: autonomous handoff + explanation trace (`agent_thoughts`)

## 2. Project Structure

```text
adaptive-disaster-response/
  frontend/     # React + Vite dashboard
  backend/      # Express + Mongo gateway
  ai-engine/    # FastAPI multi-agent simulation service
```

## 3. Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB 6+ (optional but recommended; app falls back to in-memory history if unavailable)

## 4. Setup (From Basic Block to Final Run)

### Step A: Python AI Engine

```bash
cd ai-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

Service URLs:
- `GET http://127.0.0.1:8000/health`
- `POST http://127.0.0.1:8000/simulate`
- `POST http://127.0.0.1:8000/assess`

### Step B: MERN Backend Gateway

Open a new terminal:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Service URLs:
- `GET http://127.0.0.1:5000/api/disaster/health`
- `POST http://127.0.0.1:5000/api/disaster/simulate`
- `POST http://127.0.0.1:5000/api/disaster/assess`
- `GET http://127.0.0.1:5000/api/disaster/history`

### Step C: React Frontend UI

Open another terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open: `http://127.0.0.1:5173`

## 4.1 Auth Setup

The website now requires login before the dashboard is visible.

Set these values in `frontend/.env` and `backend/.env`:

```bash
SUPABASE_URL=https://gvermgjeqpbeoaacsupq.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
```

Frontend uses Supabase email/password login. Backend validates the bearer token through Supabase before allowing access to protected endpoints.
The login screen now includes both `Login` and `Sign up` modes.

## 5. Full User Flow

1. Pick a live location in the dashboard or run a simulation from the agent panel.
2. Frontend calls backend `/assess` (live) or `/simulate` (scenario).
3. Backend forwards payload to Python AI engine.
4. Python returns:
   - `situation` (risk + hazards + weather context)
   - `official_alerts` (USGS + NASA EONET nearby hazards)
   - `resources` (response allocation)
   - `routes` (evacuation candidates)
   - `agent_thoughts` (reasoning transparency)
5. Backend stores run in MongoDB and returns response to UI.
6. UI renders dashboard panels and updates simulation history.

## 6. Scenario Modes

- `live`: pulls real-time weather from Open-Meteo
- `historical`: replays predefined Andhra-region events
- `mock`: deterministic offline simulation for demo/testing

## 7. API Payload Example

`POST /api/disaster/simulate`

```json
{
  "location": "Vijayawada",
  "scenario_mode": "historical",
  "historical_event_id": "krishna_floods_2020_vijayawada",
  "population": 25000,
  "blocked_road_ids": ["R2", "R4"]
}
```

## 8. Notes

- If MongoDB is not reachable, the backend still runs and stores history in memory.
- Historical event metadata is served by Python endpoint `/historical-events`.
- The project is designed so you can later plug in LangChain/LangGraph + LLM reasoning without changing frontend contracts.
