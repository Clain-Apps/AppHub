import { createContext, useContext } from "react";
import { createApplicationError, type HostedApplication } from "apphub-shared";
import type { ConnectionStatus, WebSocketService } from "../services/websockets.service";

export type Orientation = "portrait" | "landscape";

export interface ApplicationState {
  applications: HostedApplication[];
  isRefreshing: boolean;
  showActiveOnly: boolean;
  isAdministrator: boolean;
  connectionStatus: ConnectionStatus;
  orientation: Orientation;
  webSocket: WebSocketService | null;
  notice: string | null;
}

export interface ApplicationStateActions {
  refreshCatalog(): Promise<void>;
  setShowActiveOnly(showActiveOnly: boolean): void;
  setAdministrator(isAdministrator: boolean): void;
  updateApplicationDisplay({ folderName, displayName }: { folderName: string; displayName: string }): Promise<void>;
  uploadApplicationImage({ folderName, imageFile }: { folderName: string; imageFile: File }): Promise<void>;
  setNotice(notice: string | null): void;
}

export type ApplicationStateContextValue = ApplicationState & ApplicationStateActions;

export const ApplicationStateContext = createContext<ApplicationStateContextValue | null>(null);

export function useApplicationState(): ApplicationStateContextValue {
  const value = useContext(ApplicationStateContext);
  if (value === null) throw createApplicationError("missingApplicationState", "useApplicationState must be used inside ApplicationStateProvider");
  return value;
}
