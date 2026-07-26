import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 8093;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/serve-dist.mjs", String(port)], {
  cwd: root,
  stdio: "ignore",
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("dist server did not start");
}

try {
  await waitForServer();
  let entryAsset = "";
  for (const path of ["/", "/login", "/admin", "/admin/media", "/volunteer/tasks", "/public-gallery"]) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    assert.equal(response.status, 200, `${path} did not return SPA entry`);
    const html = await response.text();
    assert.match(html, /id="root"/, `${path} did not return index.html`);
    entryAsset ||= html.match(/src="([^"]+\.js)"/)?.[1] || "";
  }
  assert.ok(entryAsset, "entry JavaScript asset was not referenced");
  const assetResponse = await fetch(`${origin}${entryAsset}`);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type") || "", /javascript/);
  console.log("Reliability hosting smoke: public, login, admin, volunteer and gallery direct routes returned the production SPA and entry asset.");
} finally {
  server.kill();
}
