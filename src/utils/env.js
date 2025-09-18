// src/utils/env.js
export function getEnv(key) {
    const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  
    // Try Vite style first, then CRA style, then fallback
    return (
      env[`VITE_${key}`] ||
      process.env[`REACT_APP_${key}`] ||
      process.env[key]
    );
  }
  