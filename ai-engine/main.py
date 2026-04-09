from __future__ import annotations

import argparse
import json

from agents.coordinator import Coordinator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run disaster simulation from terminal.")
    parser.add_argument("--location", default="Visakhapatnam")
    parser.add_argument("--scenario-mode", default="mock", choices=["live", "historical", "mock"])
    parser.add_argument("--historical-event-id", default=None)
    parser.add_argument("--population", type=int, default=25000)
    parser.add_argument("--blocked-road-id", action="append", default=[])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    coordinator = Coordinator()
    response = coordinator.run_simulation(
        {
            "location": args.location,
            "scenario_mode": args.scenario_mode,
            "historical_event_id": args.historical_event_id,
            "population": args.population,
            "blocked_road_ids": args.blocked_road_id,
        }
    )
    print(json.dumps(response, indent=2))


if __name__ == "__main__":
    main()
