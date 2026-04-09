import React from "react";

const ResourceTable = ({ resources, title = "Resource Allocation" }) => (
  <article className="panel">
    <h2>{title}</h2>
    {resources.length === 0 ? (
      <p className="muted">No response resources allocated yet.</p>
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Resource Type</th>
              <th>Count</th>
              <th>Priority</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((item) => (
              <tr key={`${item.type}-${item.priority}`}>
                <td>{item.type}</td>
                <td>{item.count}</td>
                <td>
                  <span className={`priority-${String(item.priority).toLowerCase()}`}>
                    {item.priority}
                  </span>
                </td>
                <td>{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </article>
);

export default ResourceTable;
