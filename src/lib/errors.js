// src/lib/errors.js
export function explainError(err) {
    // Supabase-style
    if (err && typeof err === "object") {
      if (err.message) return err.message;
      if (err.error_description) return err.error_description;
      if (err.description) return err.description;
      if (err.code && err.details) return `${err.code}: ${err.details}`;
      if (err.code && err.hint) return `${err.code}: ${err.hint}`;
    }
  
    // Fetch/HTTP style
    if (err && err.status && err.statusText) {
      return `HTTP ${err.status} ${err.statusText}`;
    }
    if (err && err.name && err.reason) {
      return `${err.name}: ${err.reason}`;
    }
  
    // String / fallback
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unexpected error";
    }
  }
  
  export function logError(scope, err, extra = {}) {
    // Print a rich, structured log to devtools
    // eslint-disable-next-line no-console
    console.error(`[${scope}]`, {
      message: explainError(err),
      original: err,
      ...extra,
    });
  }
  