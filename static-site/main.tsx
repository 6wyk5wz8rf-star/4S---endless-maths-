import React from "react";
import { createRoot } from "react-dom/client";
import FluencyApp from "../app/FluencyApp";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("Fluency could not find its application root.");

createRoot(root).render(
  <React.StrictMode>
    <FluencyApp />
  </React.StrictMode>,
);
