import { Component } from "react";
import { captureError } from "@/services/telemetry";

export function ErrorFallback({ scope = "application", onRetry, onReload }) {
  return (
    <main
      role="alert"
      dir="rtl"
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fffaf5",
      }}
    >
      <section style={{
        width: "min(520px, 100%)",
        padding: 28,
        borderRadius: 16,
        background: "#fff",
        border: "1px solid #eadfd3",
        textAlign: "center",
      }}>
        <h1 style={{ marginTop: 0, color: "#7d2424", fontSize: 24 }}>משהו השתבש</h1>
        <p style={{ color: "#5f5148", lineHeight: 1.6 }}>
          לא ניתן להציג את {scope === "route" ? "העמוד" : "המערכת"} כרגע. לא נשמר כאן מידע אישי על השגיאה.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>נסה שוב</button>}
          <button type="button" className="btn" onClick={onReload || (() => window.location.reload())}>רענן את הדף</button>
        </div>
      </section>
    </main>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    captureError(error, {
      event: "react_boundary",
      scope: this.props.scope || "application",
      componentStack: info?.componentStack,
    });
  }

  retry = () => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback scope={this.props.scope} onRetry={this.retry} />;
    }
    return <div key={this.state.retryKey} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
