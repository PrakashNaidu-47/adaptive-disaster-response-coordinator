import { useEffect, useMemo, useState } from "react";

const USGS_SIGNIFICANT_DAY_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
const EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";
const REFRESH_MS = 5 * 60 * 1000;

export const hazardColors = {
  Earthquake: "#f28b30",
  Flood: "#2c7be5",
  Tornado: "#d64545",
  Hurricane: "#6f3cc3",
  Wildfire: "#e26e2c",
  "Severe Storm": "#5a5f8a",
  "Winter Storm": "#2f9ab5",
  Tsunami: "#0f8b7e",
  Volcano: "#b5512f",
  Landslide: "#8a6d3b",
  Alert: "#5b6b65",
};

export const formatTimestamp = (value) => {
  if (!value) return "Unknown time";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown time";
  }
};

const buildEarthquakeItems = (features = []) =>
  features.map((feature) => {
    const [longitude, latitude] = feature.geometry?.coordinates || [];
    const magnitude = feature.properties?.mag;
    return {
      id: feature.id,
      type: "Earthquake",
      source: "USGS",
      title: feature.properties?.title || "Earthquake",
      location: feature.properties?.place || "Unknown location",
      time: feature.properties?.time,
      magnitude,
      severity: magnitude ? `M ${magnitude.toFixed(1)}` : "Unknown",
      url: feature.properties?.url,
      latitude,
      longitude,
    };
  });

const mapEonetCategory = (category = "") => {
  const normalized = category.toLowerCase();
  if (normalized.includes("severe")) return "Severe Storm";
  if (normalized.includes("flood")) return "Flood";
  if (normalized.includes("volcano")) return "Volcano";
  if (normalized.includes("wildfire")) return "Wildfire";
  if (normalized.includes("landslide")) return "Landslide";
  return null;
};

const buildEonetItems = (events = []) =>
  events
    .map((event) => {
      const categories = event.categories || [];
      const categoryTitle = categories[0]?.title || "Event";
      const type = mapEonetCategory(categoryTitle) || "Alert";
      const geometry = event.geometry || [];
      const latest = geometry[geometry.length - 1] || {};
      const coordinates = latest.coordinates || [];
      if (coordinates.length < 2) return null;
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      const sources = event.sources || [];
      const link = sources[0]?.url;

      return {
        id: `eonet-${event.id}`,
        type,
        source: "NASA EONET",
        title: event.title || categoryTitle,
        location: categoryTitle,
        time: latest.date,
        severity: "Advisory",
        url: link,
        latitude,
        longitude,
      };
    })
    .filter(Boolean);

export const useHazardFeed = () => {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchHazards = async () => {
      setLoading(true);
      setError("");
      try {
        const [earthquakeRes, eonetRes] = await Promise.all([
          fetch(USGS_SIGNIFICANT_DAY_URL),
          fetch(
            `${EONET_EVENTS_URL}?status=open&category=severeStorms,floods,volcanoes,wildfires,landslides&limit=60`
          ),
        ]);
        if (!earthquakeRes.ok) throw new Error("USGS feed unavailable");
        if (!eonetRes.ok) throw new Error("NASA EONET feed unavailable");

        const earthquakeJson = await earthquakeRes.json();
        const eonetJson = await eonetRes.json();

        const quakeItems = buildEarthquakeItems(earthquakeJson.features || []);
        const eonetItems = buildEonetItems(eonetJson.events || []);
        const merged = [...eonetItems, ...quakeItems]
          .sort((a, b) => (b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0))
          .slice(0, 75);

        if (!isMounted) return;
        setHazards(merged);
        setLastUpdated(Date.now());
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Unable to load hazard feeds.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHazards();
    const interval = setInterval(fetchHazards, REFRESH_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const hazardCounts = useMemo(() => {
    return hazards.reduce(
      (acc, hazard) => {
        acc.total += 1;
        acc[hazard.type] = (acc[hazard.type] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [hazards]);

  return {
    hazards,
    loading,
    error,
    lastUpdated,
    hazardCounts,
  };
};
