import { useState } from "react";
import type { HostedApplication } from "apphub-shared";
import { useApplicationState } from "../state/applicationState";
import { ApplicationTile } from "./ApplicationTile";
import { EditApplicationModal } from "./EditApplicationModal";
import { filterVisibleApplications } from "./filterVisibleApplications";
import "./ApplicationGrid.scss";

export function ApplicationGrid() {
  const { applications, isRefreshing, showActiveOnly } = useApplicationState();
  const [applicationBeingEdited, setApplicationBeingEdited] = useState<HostedApplication | null>(null);
  const visibleApplications = filterVisibleApplications({ applications, showActiveOnly });

  return (
    <section className="application-grid-section" aria-busy={isRefreshing} aria-labelledby="application-grid-heading">
      <h2 id="application-grid-heading" className="application-grid-heading">
        Applications
      </h2>
      <p className="catalog-status" role="status" aria-live="polite">
        {isRefreshing ? "Checking which apps are running" : statusText({ visibleCount: visibleApplications.length, showActiveOnly })}
      </p>
      {visibleApplications.length === 0 ? (
        <div className={`application-grid-empty${isRefreshing ? " is-loading" : ""}`}>
          {isRefreshing ? <span className="loading-pulse" aria-hidden="true" /> : <p>{emptyText(showActiveOnly)}</p>}
        </div>
      ) : (
        <ul className="application-grid">
          {visibleApplications.map((application) => (
            <li key={application.folderName}>
              <ApplicationTile application={application} onEdit={setApplicationBeingEdited} />
            </li>
          ))}
        </ul>
      )}
      {applicationBeingEdited ? (
        <EditApplicationModal
          application={applicationBeingEdited}
          onClose={() => setApplicationBeingEdited(null)}
        />
      ) : null}
    </section>
  );
}

function statusText({ visibleCount, showActiveOnly }: { visibleCount: number; showActiveOnly: boolean }): string {
  if (showActiveOnly) return `${visibleCount} active ${visibleCount === 1 ? "application" : "applications"}`;
  return `${visibleCount} ${visibleCount === 1 ? "application" : "applications"}`;
}

function emptyText(showActiveOnly: boolean): string {
  return showActiveOnly ? "No active applications" : "No applications are deployed yet";
}
