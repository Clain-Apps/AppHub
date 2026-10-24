import { ApplicationGrid } from "./applications/ApplicationGrid";
import { AppHeader } from "./header/AppHeader";
import { ApplicationStateProvider } from "./state/ApplicationStateProvider";
import { useApplicationState } from "./state/applicationState";
import "./App.scss";

export function App() {
  return (
    <ApplicationStateProvider>
      <ApplicationShell />
    </ApplicationStateProvider>
  );
}

function ApplicationShell() {
  const { orientation, notice } = useApplicationState();

  return (
    <div className="app-shell">
      <div className={`app-container is-${orientation}`}>
        <AppHeader />
        <main className="app-content">
          {notice ? (
            <p className="app-notice" role="status">
              {notice}
            </p>
          ) : null}
          <div className="view-container">
            <div className="view-content">
              <ApplicationGrid />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
