import type { HostedApplication } from "apphub-shared";
import { ApplicationPlaceholder } from "./ApplicationPlaceholder";

export function ApplicationTile({
  application,
  onEdit,
}: {
  application: HostedApplication;
  onEdit(application: HostedApplication): void;
}) {
  return (
    <article className={`application-tile${application.isActive ? "" : " is-inactive"}`}>
      <a className="application-tile-link" href={application.webAddress}>
        <span className="application-tile-media">
          {application.imageAddress ? (
            <img src={application.imageAddress} alt={application.displayName} />
          ) : (
            <ApplicationPlaceholder />
          )}
        </span>
        <h2>{application.displayName}</h2>
      </a>
      <button
        type="button"
        className="application-tile-edit"
        onClick={(event) => {
          event.preventDefault();
          onEdit(application);
        }}
      >
        Edit
      </button>
    </article>
  );
}
