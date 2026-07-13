import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DependencyGuard } from "./components/updater/DependencyGuard";
import { LanguageProvider } from "./i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <DependencyGuard>
        <App />
      </DependencyGuard>
    </LanguageProvider>
  </React.StrictMode>,
);
