import React from "react";
import { createRoot } from "react-dom/client";
import FluencyApp from "../app/FluencyApp";
import "../app/globals.css";
import "../app/pupil-final.css";

const root = document.getElementById("root");

if (!root) throw new Error("4S Arithmetic could not start.");

createRoot(root).render(
  <React.StrictMode>
    <FluencyApp />
  </React.StrictMode>,
);
