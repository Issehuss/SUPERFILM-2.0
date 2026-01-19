# Auth Fetch Rule (Frontend)

Auth is eventually consistent. Sessions can be null briefly after idle.
Background reads must never abort when auth is missing.

Rules:
- Never gate fetches with `if (!user) return` or `if (!session) return`.
- Always resolve session inside the fetch and retry if null.
- Use `useSafeSupabaseFetch` for background reads.
- Never return `null` while loading; render a shell + skeleton instead.
