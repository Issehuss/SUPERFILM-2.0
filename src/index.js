import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWrapper from './App'; // ✅ wrapped with <Router> and <UserProvider>
import reportWebVitals from './reportWebVitals';

import { env } from "./lib/env";
console.log("[SF] ENV CHECK", {
  url: env.SUPABASE_URL,
  anonPrefix: env.SUPABASE_ANON_KEY?.slice(0, 8) || null,
  funcs: env.SUPABASE_FUNCTIONS_URL,
  nodeEnv: env.NODE_ENV,
});


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

reportWebVitals();

