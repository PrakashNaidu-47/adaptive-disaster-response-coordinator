# AI Engine (FastAPI + Multi-Agent Python)

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `GET /historical-events`
- `POST /simulate`

## CLI Quick Check

```bash
python main.py --location Vijayawada --scenario-mode mock
```

## Agent Modules

- `agents/situation_agent.py`
- `agents/resource_agent.py`
- `agents/evacuation_agent.py`
- `agents/coordinator.py`
