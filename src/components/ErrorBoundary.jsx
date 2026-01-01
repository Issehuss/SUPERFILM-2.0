import React from "react";

/**
 * Lightweight error boundary to prevent a full white screen on unexpected errors.
 * Shows a simple fallback and logs to console for debugging.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep logging minimal; surfaces in dev console.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    const { hasError } = this.state;
    const { fallback = null, children } = this.props;
    if (hasError) return fallback;
    return children;
  }
}
