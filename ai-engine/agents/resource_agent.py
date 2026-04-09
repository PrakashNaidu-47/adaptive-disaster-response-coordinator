from __future__ import annotations

from typing import Dict, List


class ResourceAgent:
    def allocate(
        self,
        risk_level: str,
        population: int,
        hazards: List[str],
        facilities: List[Dict[str, object]],
        flood_level: str,
    ) -> List[Dict[str, object]]:
        pop_factor = max(1, int(population / 15000))
        is_flood = any("flood" in item.lower() for item in hazards)
        is_wind = any("wind" in item.lower() for item in hazards)
        hospitals = sum(1 for item in facilities if item["category"] == "hospital")
        ambulance_stations = sum(1 for item in facilities if item["category"] == "ambulance_station")
        shelter_sites = sum(
            1 for item in facilities if item["category"] in {"shelter", "school", "community_centre"}
        )

        base_resources: List[Dict[str, object]] = [
            {
                "type": "Medical Response Unit",
                "count": 1 * pop_factor,
                "priority": "MEDIUM",
                "reason": "Baseline emergency medical readiness.",
            },
            {
                "type": "Rapid Assessment Team",
                "count": 1,
                "priority": "LOW",
                "reason": "Field validation of AI-generated situational inputs.",
            },
            {
                "type": "Nearby Hospitals",
                "count": max(1, hospitals),
                "priority": "MEDIUM",
                "reason": "Live facility discovery found nearby hospital coverage.",
            },
        ]

        if risk_level == "MODERATE":
            base_resources.extend(
                [
                    {
                        "type": "Ambulance",
                        "count": 2 * pop_factor,
                        "priority": "HIGH",
                        "reason": "Increased probability of rescue and medical transport calls.",
                    },
                    {
                        "type": "Shelter Activation Sites",
                        "count": max(1, shelter_sites),
                        "priority": "MEDIUM",
                        "reason": "Nearby schools and community centres can be activated as shelters.",
                    },
                ]
            )

        if risk_level == "CRITICAL":
            base_resources.extend(
                [
                    {
                        "type": "Ambulance",
                        "count": 3 * pop_factor,
                        "priority": "HIGH",
                        "reason": "Critical risk requires maximum trauma-response mobility.",
                    },
                    {
                        "type": "Disaster Relief Trucks",
                        "count": 2 * pop_factor,
                        "priority": "HIGH",
                        "reason": "Food, water, and generator transport during route disruption.",
                    },
                    {
                        "type": "National Disaster Force Team",
                        "count": 1,
                        "priority": "HIGH",
                        "reason": "High-intensity response for wide-area incident management.",
                    },
                    {
                        "type": "Ambulance Stations On Alert",
                        "count": max(1, ambulance_stations),
                        "priority": "HIGH",
                        "reason": "Live ambulance coverage should be mobilized immediately.",
                    },
                ]
            )

        if is_flood or flood_level in {"MODERATE", "HIGH"}:
            base_resources.append(
                {
                    "type": "Inflatable Rescue Boats",
                    "count": max(2, pop_factor),
                    "priority": "HIGH",
                    "reason": "Flood hazard present and road mobility may collapse.",
                }
            )

        if is_wind:
            base_resources.append(
                {
                    "type": "Electrical Repair Crew",
                    "count": max(1, int(pop_factor / 2)),
                    "priority": "MEDIUM",
                    "reason": "Wind damage frequently affects power distribution lines.",
                }
            )

        return base_resources
