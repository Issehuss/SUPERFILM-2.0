// src/utils/env.js
export function getEnv(name, { require = false } = {}) {
  // Prefer Vite-style first when present
  const vite = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const val =
    vite[`VITE_${name}`] ??
    // CRA-style
    (typeof process !== "undefined" && process.env?.[`REACT_APP_${name}`]) ??
    // fallback to unprefixed (node/server)
    (typeof process !== "undefined" && process.env?.[name]) ??
    null;

  if (require && (val === null || val === undefined || val === "")) {
    throw new Error(
      `Missing env ${name}. Set REACT_APP_${name} (CRA) or VITE_${name} (Vite).`
    );
  }
  return val;
}
