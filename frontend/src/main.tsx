import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationError } from "apphub-shared";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (rootElement === null) throw createApplicationError("missingRootElement", "The page has no root element");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
