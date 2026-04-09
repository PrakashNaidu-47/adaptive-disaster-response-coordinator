import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "adr_custom_facilities";

const loadCustomFacilities = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const FacilityManager = ({ facilities }) => {
  const [customFacilities, setCustomFacilities] = useState(loadCustomFacilities);
  const [form, setForm] = useState({
    name: "",
    category: "Shelter",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customFacilities));
  }, [customFacilities]);

  const combinedFacilities = useMemo(() => {
    const liveFacilities = (facilities || []).map((facility) => ({
      ...facility,
      sourceLabel: facility.source || "Live discovery",
    }));
    const custom = customFacilities.map((facility) => ({
      ...facility,
      sourceLabel: "Manual entry",
    }));
    return [...custom, ...liveFacilities];
  }, [facilities, customFacilities]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAdd = () => {
    if (!form.name || !form.latitude || !form.longitude) return;
    const entry = {
      id: `custom-${Date.now()}`,
      name: form.name,
      category: form.category,
      coordinates: {
        lat: Number(form.latitude),
        lon: Number(form.longitude),
      },
      distance_km: 0,
    };
    setCustomFacilities((current) => [entry, ...current]);
    setForm({ name: "", category: "Shelter", latitude: "", longitude: "" });
  };

  return (
    <article className="panel">
      <h2>Facility Management</h2>
      <p className="context-note">
        Add safe zones, hospitals, or command centers. Manual entries are stored in this browser.
      </p>
      <div className="form-grid">
        <label>
          Facility name
          <input
            type="text"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="e.g. District Control Room"
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(event) => handleChange("category", event.target.value)}
          >
            <option value="Shelter">Shelter</option>
            <option value="Hospital">Hospital</option>
            <option value="Command Center">Command Center</option>
            <option value="Relief Camp">Relief Camp</option>
          </select>
        </label>
        <label>
          Latitude
          <input
            type="number"
            value={form.latitude}
            onChange={(event) => handleChange("latitude", event.target.value)}
            placeholder="13.6288"
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            value={form.longitude}
            onChange={(event) => handleChange("longitude", event.target.value)}
            placeholder="79.4192"
          />
        </label>
        <button type="button" onClick={handleAdd}>
          Add Facility
        </button>
      </div>

      {combinedFacilities.length === 0 ? (
        <p className="muted">No facilities available for this location yet.</p>
      ) : (
        <div className="facility-grid">
          {combinedFacilities.map((facility) => (
            <div className="facility-card" key={facility.id}>
              <h3>{facility.name}</h3>
              <p className="context-note">{facility.category}</p>
              <p className="context-note">
                {facility.coordinates?.lat?.toFixed?.(3) || facility.coordinates?.lat},{" "}
                {facility.coordinates?.lon?.toFixed?.(3) || facility.coordinates?.lon}
              </p>
              <span className="facility-source">{facility.sourceLabel}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

export default FacilityManager;

