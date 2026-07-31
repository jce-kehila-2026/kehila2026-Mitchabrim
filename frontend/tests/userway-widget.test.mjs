import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

test("UserWay is loaded immediately as a single persistent script", () => {
  assert.equal(
    appSource.match(/https:\/\/cdn\.userway\.org\/widget\.js/g)?.length,
    1,
    "the UserWay CDN script must have exactly one loader",
  );
  assert.match(appSource, /getElementById\("userway-script"\)/);
  assert.doesNotMatch(appSource, /setTimeout[\s\S]{0,800}userway-script/);
  assert.doesNotMatch(appSource, /(?:removeChild|\.remove\(\))[\s\S]{0,300}userway-script/);
});

test("UserWay account, position and color remain configured", () => {
  assert.match(appSource, /data-account/);
  assert.match(appSource, /data-position", "5"/);
  assert.match(appSource, /data-color", "#8b2c2c"/);
});

test("application CSS does not override or hide UserWay internals", () => {
  assert.doesNotMatch(appCss, /userway/i);
});
