import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWrapper from './App'; // ✅ wrapped with <Router> and <UserProvider>
import reportWebVitals from './reportWebVitals';
import BetaGate from "./components/BetaGate";
import AuthGate from "./components/AuthGate";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

import { env, missingCriticalEnv } from "./lib/env";
if (process.env.NODE_ENV === "development") {
  const missing = missingCriticalEnv();
  if (missing.length) {
    console.warn("[SF] Missing critical env vars:", missing.join(", "));
  }
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthGate>
      <BetaGate>
        <AppWrapper />
      </BetaGate>
    </AuthGate>
  </React.StrictMode>
);

reportWebVitals();
serviceWorkerRegistration.register();
