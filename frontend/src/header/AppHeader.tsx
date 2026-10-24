import { useRef } from "react";
import { useApplicationState } from "../state/applicationState";
import "./AppHeader.scss";

const administratorHoldDurationMilliseconds = 5_000;

export function AppHeader() {
  const { isAdministrator, isRefreshing, showActiveOnly, setAdministrator, setShowActiveOnly, refreshCatalog } = useApplicationState();
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ignoreNextClick = useRef(false);

  return (
    <header className="app-header">
      <h1
        className={`app-title${isAdministrator ? " is-administrator" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerLeave={clearHold}
        onClick={handleClick}
      >
        AppHub
      </h1>
      <div className="app-header-controls">
        <label className="active-filter">
          Active
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(event) => setShowActiveOnly(event.target.checked)}
          />
        </label>
        <button type="button" className="secondary" onClick={() => refreshCatalog()} disabled={isRefreshing}>
          Refresh
        </button>
      </div>
      {isAdministrator ? (
        <p className="administrator-status" role="status">
          Administrator editing is on
        </p>
      ) : null}
    </header>
  );

  function handlePointerDown(): void {
    clearHold();
    holdTimeout.current = setTimeout(() => {
      ignoreNextClick.current = true;
      setAdministrator(true);
    }, administratorHoldDurationMilliseconds);
  }

  function handleClick(): void {
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }
    setAdministrator(false);
  }

  function clearHold(): void {
    if (holdTimeout.current === undefined) return;
    clearTimeout(holdTimeout.current);
    holdTimeout.current = undefined;
  }
}
