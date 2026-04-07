"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[SIS ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 40, gap: 16, color: "var(--color-text-muted)", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>⚠</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Ein Fehler ist aufgetreten</div>
          <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 400 }}>
            {this.state.error?.message ?? "Unbekannter Fehler"}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 8,
              border: "1px solid var(--color-border)", background: "var(--color-surface)",
              color: "var(--color-text-secondary)", cursor: "pointer",
            }}
          >Neu laden</button>
        </div>
      );
    }
    return this.props.children;
  }
}
