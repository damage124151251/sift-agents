import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const production = process.argv.includes("--production");
const base = production
  ? "https://sift-agents.vercel.app"
  : "http://127.0.0.1:5249";
const root = new URL("../", import.meta.url),
  out = new URL("artifacts/qa/", root);
await mkdir(out, { recursive: true });
const status = await fetch(base + "/api/status").then((r) => r.json());
assert.ok(status.sources.length > 0);
assert.ok(
  status.reports.length > 0,
  "Provision a real source check before browser QA.",
);
assert.ok(
  status.reports.every(
    (r) =>
      r.url.startsWith("https://github.com/") &&
      /^[a-f0-9]{64}$/.test(r.inputHash),
  ),
);
assert.equal((await fetch(base + "/api/operator")).status, 401);
assert.equal((await fetch(base + "/api/tick")).status, 401);
assert.equal((await fetch(base + "/api/watch")).status, 401);
assert.ok(!JSON.stringify(status).includes("Bearer "));

const browser = await chromium.launch({ headless: true });
const failures = [],
  checks = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("pageerror", (e) => failures.push(e.message));
async function checkLayout(label) {
  const info = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    overflow: [
      ...document.querySelectorAll("button,input,h1,h2,.run-text,.details dd"),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          (r.left < -1 || r.right > innerWidth + 1)
        );
      })
      .map((el) => el.textContent?.slice(0, 70)),
  }));
  assert.ok(
    info.scroll <= info.width + 1,
    `${label}: document overflow ${JSON.stringify(info)}`,
  );
  assert.deepEqual(info.overflow, [], `${label}: control overflow`);
  checks.push(label);
}
async function shot(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
    fullPage: true,
  });
}
async function closeDialog() {
  await page.getByRole("button", { name: "Close", exact: true }).click();
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector(".intro"), {
    timeout: 8000,
  });
  await page.locator(".run-row").first().waitFor();
  await checkLayout("desktop1440");
  await shot("desktop");
  assert.equal(
    await page
      .getByRole("link", { name: "SIFT source on GitHub" })
      .getAttribute("href"),
    "https://github.com/damage124151251/sift-agents",
  );
  const pixels = await page.locator(".workbench-canvas").evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4)
      if (
        d[i + 3] &&
        Math.max(d[i], d[i + 1], d[i + 2]) -
          Math.min(d[i], d[i + 1], d[i + 2]) >
          50
      )
        colored++;
    return colored;
  });
  assert.ok(pixels > 500, "Agent workbench must have visible colored pixels.");
  await page.getByRole("button", { name: "Replay opening" }).click();
  await page.waitForTimeout(450);
  const frame1 = await page
    .locator(".intro>canvas")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(600);
  const frame2 = await page
    .locator(".intro>canvas")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(frame1, frame2, "Native intro must animate.");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".intro").count(), 0);
  assert.equal(
    await page.locator("video").count(),
    0,
    "Intro is native pixel animation, not a video.",
  );
  await page.getByRole("button", { name: "Read report" }).click();
  await checkLayout("report-desktop");
  await shot("report");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const download = await downloaded,
    path = await download.path();
  const report = JSON.parse(await readFile(path, "utf8"));
  assert.ok(
    status.reports.some(
      (r) => r.id === report.id && r.inputHash === report.inputHash,
    ),
  );
  await closeDialog();
  await page
    .getByRole("button", { name: "Replay this completed workflow" })
    .click();
  await page.getByText("Historical run replay", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  const replay1 = await page
    .locator(".workbench-canvas")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(400);
  const replay2 = await page
    .locator(".workbench-canvas")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(replay1, replay2, "Workflow replay must animate.");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Runs", exact: true })
    .click();
  await page.getByRole("button", { name: "Blocked", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Blocked", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search repository" })
    .fill("no-such-source-qa");
  assert.equal(await page.locator(".run-row").count(), 0);
  await page.getByRole("textbox", { name: "Search repository" }).fill("");
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export run history" }).click();
  assert.equal((await exportPromise).suggestedFilename(), "sift-runs.json");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect source", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Operator access" }).waitFor();
  await page
    .getByLabel("Operator key", { exact: true })
    .fill("invalid-key-that-is-at-least-32-characters");
  await page.getByRole("button", { name: "Unlock controls" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Operator access required" })
    .waitFor();
  await closeDialog();
  if (!production) {
    const secrets = JSON.parse(
      await readFile(new URL(".local/dev-access.json", root), "utf8"),
    );
    const rejected = await fetch(base + "/api/operator", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secrets.operator}`,
        Origin: "https://untrusted.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pause", paused: true }),
    });
    assert.equal(rejected.status, 403);
    await page
      .getByRole("button", { name: "Operator access", exact: true })
      .click();
    await page
      .getByLabel("Operator key", { exact: true })
      .fill(secrets.operator);
    await page.getByRole("button", { name: "Unlock controls" }).click();
    await page
      .getByRole("button", { name: "Operator session", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Connect source", exact: true })
      .click();
    await page
      .getByLabel("GitHub repository", { exact: true })
      .fill("http://localhost/private");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Connect source", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    await closeDialog();
    await page
      .getByRole("button", { name: "Operator session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lock controls", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Token monitor", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Token monitor" }).waitFor();
  if (!status.identity.wallet)
    await page
      .getByText("Awaiting a development wallet", { exact: true })
      .waitFor();
  await closeDialog();
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1080 });
    for (const view of ["Workroom", "Runs", "Sources", "Protocol"]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: view, exact: true })
        .click();
      await page.waitForTimeout(150);
      await checkLayout(`${view}-${width}`);
      if (view === "Workroom") await shot(`workroom-${width}`);
    }
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Workroom", exact: true })
      .click();
    await page.getByRole("button", { name: "Read report" }).click();
    await checkLayout(`report-${width}`);
    if (width === 390) await shot("report-mobile");
    await closeDialog();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Replay opening" }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".intro").count(), 0);
  const png = await sharp(
    fileURLToPath(new URL("workroom-390.png", out)),
  ).stats();
  assert.ok(
    png.channels.some((c) => c.stdev > 12),
    "Mobile screenshot must be nonblank.",
  );
  assert.deepEqual(failures, [], "Browser JavaScript errors");
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(
      {
        base,
        at: new Date().toISOString(),
        checks,
        pixels,
        realReport: report.id,
        errors: failures,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ok: true,
      base,
      layouts: checks.length,
      realReport: report.id,
      canvasColoredPixels: pixels,
    }),
  );
} finally {
  await browser.close();
}
