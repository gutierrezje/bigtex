import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installBigTexPerfBridge } from "./perf/bigtex-perf";
import { PerfProfiler } from "./perf/PerfProfiler";
import "./styles/app.css";

installBigTexPerfBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PerfProfiler id="App">
      <App />
    </PerfProfiler>
  </React.StrictMode>,
);
