import React from "react";

import FacilityManager from "../components/FacilityManager";
import ResourceTable from "../components/ResourceTable";
import RouteMap from "../components/RouteMap";
import { useAssessment } from "../state/AssessmentContext";

const OperationsPage = () => {
  const { latestAssessment } = useAssessment();
  const resources = latestAssessment?.resources || [];
  const routes = latestAssessment?.routes || [];
  const facilities = latestAssessment?.facilities || [];

  return (
    <div className="dashboard-page">
      <section className="hero">
        <p className="hero-eyebrow">Operations & Resource Allocation</p>
        <h1>Coordinate assets and logistics</h1>
        <p className="hero-copy">
          Review resource allocations, live evacuation routes, and facility readiness without
          leaving the operations view.
        </p>
      </section>

      {!latestAssessment ? (
        <article className="panel">
          <h2>No live assessment loaded</h2>
          <p className="muted">
            Run a live assessment from the Command Dashboard to populate resources, routes, and
            facility intelligence.
          </p>
        </article>
      ) : null}

      <section className="results-grid">
        <ResourceTable title="Asset Inventory" resources={resources} />
        <RouteMap title="Active Route Recommendations" routes={routes} />
      </section>

      <FacilityManager facilities={facilities} />
    </div>
  );
};

export default OperationsPage;

