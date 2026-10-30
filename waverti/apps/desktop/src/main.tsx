import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionProvider, ToastProvider } from "@waverti/ui";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionProvider>
  </StrictMode>,
);
