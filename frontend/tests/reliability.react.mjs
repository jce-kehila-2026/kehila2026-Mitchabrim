import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
try {
  const { default: ErrorBoundary, ErrorFallback } = await server.ssrLoadModule(
    "/src/components/common/ErrorBoundary.jsx",
  );
  const fallback = renderToStaticMarkup(React.createElement(ErrorFallback, {
    scope: "route",
    onRetry: () => {},
    onReload: () => {},
  }));
  assert.match(fallback, /role="alert"/);
  assert.match(fallback, /נסה שוב/);
  assert.match(fallback, /רענן את הדף/);

  const boundary = new ErrorBoundary({ scope: "route", children: React.createElement("p", null, "child") });
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error("synthetic render failure"));
  const caught = renderToStaticMarkup(boundary.render());
  assert.match(caught, /משהו השתבש/);
  boundary.componentDidCatch(new Error("synthetic render failure"), { componentStack: "<Synthetic />" });
  console.log("Reliability React behavior: route fallback rendered with alert, retry and reload; synthetic render failure was captured.");
} finally {
  await server.close();
}
