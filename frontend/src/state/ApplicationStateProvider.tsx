import { type EventFromBackend, type HostedApplication, createApplicationError, isApplicationError } from "apphub-shared";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ConnectionStatus, createWebSocketService } from "../services/websockets.service";
import { type ApplicationStateContextValue, type Orientation, ApplicationStateContext } from "./applicationState";

function readOrientation(): Orientation {
  return window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
}

export function ApplicationStateProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<HostedApplication[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("closed");
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);
  const [notice, setNotice] = useState<string | null>(null);
  const [webSocket] = useState(() => createWebSocketService({ webAddress: applicationSocketAddress() }));
  const hasSubscribed = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(orientation: portrait)");
    function handleChange() {
      setOrientation(readOrientation());
    }
    media.addEventListener("change", handleChange);
    window.addEventListener("resize", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
      window.removeEventListener("resize", handleChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stopListening: (() => Promise<void>) | undefined;
    let attachPromise: Promise<void> | undefined;

    const stopStatus = webSocket.onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      if (status !== "open" || cancelled) return;
      attachCatalogSubscription()
        .then(() => webSocket.send({ message: "refreshCatalog", data: {} }))
        .catch((error: unknown) => {
          if (!cancelled) setNotice(describeApplicationError(error));
        });
    });

    webSocket.connect().catch((error: unknown) => {
      if (!cancelled) setNotice(describeApplicationError(error));
    });

    return () => {
      cancelled = true;
      hasSubscribed.current = false;
      stopStatus();
      stopListening?.().catch(() => undefined);
      webSocket.close();
    };

    async function attachCatalogSubscription(): Promise<void> {
      if (stopListening) return;
      if (!attachPromise) {
        attachPromise = webSocket.subscribe("catalog", handleCatalogEvent).then((unsubscribe) => {
          stopListening = unsubscribe;
          hasSubscribed.current = true;
        });
      }
      await attachPromise;
    }

    function handleCatalogEvent(event: EventFromBackend): void {
      if (event.topic !== "catalog") return;
      if (event.name === "catalogRefreshStarted") {
        setIsRefreshing(true);
        return;
      }
      setApplications(event.applications);
      setIsRefreshing(false);
      setNotice(null);
    }
  }, [webSocket]);

  const refreshCatalog = useCallback(async () => {
    try {
      await webSocket.send({ message: "refreshCatalog", data: {} });
    } catch (error) {
      setNotice(describeApplicationError(error));
    }
  }, [webSocket]);

  const setAdministrator = useCallback((nextIsAdministrator: boolean) => {
    setIsAdministrator(nextIsAdministrator);
  }, []);

  const updateApplicationDisplay = useCallback(
    async ({ folderName, displayName }: { folderName: string; displayName: string }) => {
      try {
        await webSocket.send({ message: "updateApplicationDisplay", data: { folderName, displayName } });
      } catch (error) {
        setNotice(describeApplicationError(error));
        throw error;
      }
    },
    [webSocket],
  );

  const uploadApplicationImage = useCallback(async ({ folderName, imageFile }: { folderName: string; imageFile: File }) => {
    try {
      const body = new FormData();
      body.append("folderName", folderName);
      body.append("image", imageFile);
      const response = await fetch(`${import.meta.env.BASE_URL}api/application-image`, { method: "POST", body });
      const payload = (await response.json()) as { error?: { code?: string; message?: string } };
      if (!response.ok) {
        throw createApplicationError(payload.error?.code ?? "imageUploadFailed", payload.error?.message ?? "The image could not be saved");
      }
    } catch (error) {
      setNotice(describeApplicationError(error));
      throw error;
    }
  }, []);

  const value = useMemo<ApplicationStateContextValue>(
    () => ({
      applications,
      isRefreshing,
      showActiveOnly,
      isAdministrator,
      connectionStatus,
      orientation,
      webSocket,
      notice,
      refreshCatalog,
      setShowActiveOnly,
      setAdministrator,
      updateApplicationDisplay,
      uploadApplicationImage,
      setNotice,
    }),
    [applications, isRefreshing, showActiveOnly, isAdministrator, connectionStatus, orientation, webSocket, notice, refreshCatalog, setAdministrator, updateApplicationDisplay, uploadApplicationImage],
  );

  return <ApplicationStateContext.Provider value={value}>{children}</ApplicationStateContext.Provider>;
}

function applicationSocketAddress(): string {
  return `${window.location.origin.replace(/^http/, "ws")}${import.meta.env.BASE_URL}socket`;
}

export function describeApplicationError(error: unknown): string {
  if (isApplicationError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
