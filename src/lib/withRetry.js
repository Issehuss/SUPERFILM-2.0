export async function withRetry(fn, { retries = 2, delayMs = 400 } = {}) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try { return await fn(); } catch (e) { lastErr = e; }
      await new Promise(r => setTimeout(r, delayMs));
    }
    throw lastErr;
  }
  