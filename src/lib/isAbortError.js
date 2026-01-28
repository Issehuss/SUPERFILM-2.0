export default function isAbortError(err) {
  if (!err) return false;
  if (err?.name === "AbortError") return true;
  if (typeof err?.message === "string" && err.message === "Load failed") return true;
  return false;
}
