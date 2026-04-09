import React, { useEffect, useRef, useState } from "react";

const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER = [14.7504, 78.5700];
const INITIAL_PIN = {
  location: "Tirupati, Andhra Pradesh, India",
  latitude: 13.6288,
  longitude: 79.4192,
};

let leafletLoader;

const loadLeaflet = async () => {
  if (window.L) return window.L;
  if (leafletLoader) return leafletLoader;

  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return leafletLoader;
};

const reverseGeocode = async (latitude, longitude) => {
  try {
    const params = new URLSearchParams({
      lat: latitude,
      lon: longitude,
      format: "jsonv2",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const payload = await response.json();
    return payload.display_name || `Pinned Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
  } catch {
    return `Pinned Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
  }
};

const forwardGeocode = async (query) => {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    if (!response.ok) throw new Error("Forward geocoding failed");
    return await response.json();
  } catch {
    return [];
  }
};

const MapPicker = ({ onLocationChange, selectedLocation = null }) => {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const [mapError, setMapError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState({
    ...(selectedLocation || INITIAL_PIN),
  });

  useEffect(() => {
    let isMounted = true;

    const applySelection = (nextLocation, zoomLevel = 11, shouldNotify = true) => {
      setSelected(nextLocation);
      if (shouldNotify) {
        onLocationChange(nextLocation);
      }

      if (leafletMapRef.current && markerRef.current) {
        markerRef.current.setLatLng([nextLocation.latitude, nextLocation.longitude]);
        leafletMapRef.current.setView(
          [nextLocation.latitude, nextLocation.longitude],
          Math.max(leafletMapRef.current.getZoom(), zoomLevel)
        );
      } else {
        pendingSelectionRef.current = { nextLocation, zoomLevel };
      }
    };

    const init = async () => {
      try {
        const L = await loadLeaflet();
        if (!isMounted || !mapRef.current || leafletMapRef.current) return;

        const map = L.map(mapRef.current, {
          zoomControl: true,
        }).setView(DEFAULT_CENTER, 7);

        leafletMapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        const seed = pendingSelectionRef.current?.nextLocation || selected;
        markerRef.current = L.marker([seed.latitude, seed.longitude]).addTo(map);

        map.on("click", async (event) => {
          const { lat, lng } = event.latlng;
          markerRef.current.setLatLng([lat, lng]);
          const label = await reverseGeocode(lat, lng);
          const nextLocation = {
            location: label,
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
          };
          if (!isMounted) return;
          applySelection(nextLocation, map.getZoom(), true);
        });

        if (pendingSelectionRef.current) {
          applySelection(
            pendingSelectionRef.current.nextLocation,
            pendingSelectionRef.current.zoomLevel,
            false
          );
          pendingSelectionRef.current = null;
        } else {
          applySelection(selected, map.getZoom(), true);
        }
      } catch {
        if (isMounted) {
          setMapError("Map could not be loaded in this environment.");
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [onLocationChange]);

  useEffect(() => {
    if (!selectedLocation) return;
    const isSame =
      selectedLocation.latitude === selected.latitude &&
      selectedLocation.longitude === selected.longitude &&
      selectedLocation.location === selected.location;
    if (isSame) return;

    setSelected(selectedLocation);
    if (leafletMapRef.current && markerRef.current) {
      markerRef.current.setLatLng([selectedLocation.latitude, selectedLocation.longitude]);
      leafletMapRef.current.setView(
        [selectedLocation.latitude, selectedLocation.longitude],
        Math.max(leafletMapRef.current.getZoom(), 11)
      );
    } else {
      pendingSelectionRef.current = { nextLocation: selectedLocation, zoomLevel: 11 };
    }
  }, [selectedLocation, selected.latitude, selected.longitude, selected.location]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError("Enter a place or address to search.");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    const results = await forwardGeocode(query);
    setSearchResults(results);
    if (!results.length) {
      setSearchError("No matching locations found. Try a nearby landmark.");
    }
    setSearchLoading(false);
  };

  const handleResultSelect = (result) => {
    const latitude = Number(parseFloat(result.lat).toFixed(6));
    const longitude = Number(parseFloat(result.lon).toFixed(6));
    const nextLocation = {
      location: result.display_name || `Pinned Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      latitude,
      longitude,
    };

    setSearchQuery(result.display_name || searchQuery);
    setSearchResults([]);
    setSearchError("");

    setSelected(nextLocation);
    onLocationChange(nextLocation);

    if (leafletMapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      leafletMapRef.current.setView(
        [latitude, longitude],
        Math.max(leafletMapRef.current.getZoom(), 11)
      );
    }
  };

  return (
    <article className="panel map-panel">
      <div className="map-panel-header">
        <div>
          <h2>Live Location Map</h2>
          <p className="hero-copy">Click anywhere on the map to drop a pin, or search to jump to a location.</p>
        </div>
        <form className="map-search" onSubmit={handleSearchSubmit}>
          <label>
            <span className="status-label">Search Location</span>
            <div className="map-search-row">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="City, address, or landmark"
              />
              <button type="submit" className="solid-button" disabled={searchLoading}>
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </label>
          {searchError ? <span className="error">{searchError}</span> : null}
          {searchResults.length ? (
            <div className="map-search-results">
              {searchResults.map((result) => (
                <button
                  type="button"
                  key={`${result.place_id}-${result.lat}-${result.lon}`}
                  onClick={() => handleResultSelect(result)}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </div>

      {mapError ? <p className="error">{mapError}</p> : null}
      <div ref={mapRef} className="map-canvas" />

      <div className="map-selection">
        <div>
          <span className="status-label">Selected Location</span>
          <strong>{selected.location}</strong>
        </div>
        <div>
          <span className="status-label">Coordinates</span>
          <strong>
            {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
          </strong>
        </div>
      </div>
    </article>
  );
};

export default MapPicker;
