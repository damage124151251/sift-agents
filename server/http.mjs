import { randomUUID, timingSafeEqual } from "node:crypto";
import { readState, updateState } from "./store.mjs";
import { source } from "./config.mjs";
import { addressValid } from "../src/domain.mjs";
import { GITHUB_URL, TOKEN_CA, X_URL } from "../src/config.mjs";
import { createGitHub, verifyRepo } from "./github.mjs";
import { tick } from "./worker.mjs";
import { watchLaunch } from "./launch.mjs";
import { createRpc, MAINNET_GENESIS } from "./rpc.mjs";
export function authorized(req, secret) {
  const value = req.headers.authorization || "",
    expected = `Bearer ${secret}`;
  return (
    typeof secret === "string" &&
    secret.length >= 32 &&
    typeof value === "string" &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
};
async function body(req) {
  if (req.body && typeof req.body === "object") {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 8192)
      throw Error("Invalid request size.");
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 8192) throw Error("Invalid request size.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Error("Invalid JSON request.");
  }
}
export async function handler(req, res) {
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    if (path === "/api/health" && req.method === "GET")
      return json(res, 200, {
        ok: true,
        service: "SIFT",
        mode: "rule-based-observation",
      });
    if (path === "/api/status" && req.method === "GET") {
      const { data } = await readState(),
        now = Date.now(),
        tokenCA = TOKEN_CA || data.launchState?.pinned?.mint || null;
      const sources = data.sources.map(({ etag, ...s }) => s),
        runs = data.runs.map((r) =>
          r.status === "running" && (!data.lease || data.lease.until < now)
            ? {
                ...r,
                status: "interrupted",
                error: "Worker did not finish within its lease.",
              }
            : r,
        );
      return json(res, 200, {
        paused: data.paused,
        sources,
        runs,
        reports: data.reports,
        events: data.events,
        lastCompleted: data.lastCompleted,
        lastScheduledCompletion: data.lastScheduledCompletion,
        cycleCount: data.cycleCount,
        serverTime: new Date(now).toISOString(),
        running: !!data.lease && data.lease.until > now,
        scheduler: {
          minutes: 10,
          configured: !!process.env.VERCEL && !!process.env.CRON_SECRET,
        },
        identity: {
          wallet: data.identitySettings?.wallet || null,
          startSlot: data.identitySettings?.startSlot || null,
          tokenCA,
          proof:
            data.launchState?.pinned?.mint === tokenCA
              ? data.launchState.pinned
              : null,
          github: GITHUB_URL,
          x: X_URL,
          watchStatus: data.watchStatus,
          checkedAt: data.watchAt || null,
        },
      });
    }
    if (
      (path === "/api/tick" || path === "/api/watch") &&
      req.method === "GET"
    ) {
      if (!authorized(req, process.env.CRON_SECRET))
        return json(res, 401, { error: "Scheduler authorization required." });
      return json(
        res,
        200,
        path === "/api/tick" ? await tick() : await watchLaunch(),
      );
    }
    if (path !== "/api/operator")
      return json(res, 404, { error: "Not found." });
    if (!authorized(req, process.env.SIFT_OPERATOR_KEY))
      return json(res, 401, { error: "Operator access required." });
    if (req.method === "GET") return json(res, 200, { authorized: true });
    if (req.method !== "POST")
      return json(res, 405, { error: "Method not allowed." });
    const origins = (
      process.env.PUBLIC_ORIGINS ||
      process.env.PUBLIC_ORIGIN ||
      "http://127.0.0.1:5249"
    )
      .split(",")
      .map((s) => s.trim());
    if (req.headers.origin && !origins.includes(req.headers.origin))
      return json(res, 403, { error: "Origin rejected." });
    const input = await body(req);
    if (input.action === "run")
      return json(res, 200, await tick({ manual: true }));
    if (input.action === "watch") return json(res, 200, await watchLaunch());
    if (input.action === "add-source") {
      const repo = await verifyRepo(input.repo, createGitHub()),
        id = randomUUID();
      await updateState((s) => {
        if (s.sources.length >= 3)
          throw Error("This workroom supports three public repositories.");
        if (s.sources.some((x) => x.repo.toLowerCase() === repo.toLowerCase()))
          throw Error("This repository is already connected.");
        s.sources.push(source(repo, id));
        return s;
      });
      return json(res, 201, { id });
    }
    if (input.action === "toggle-source") {
      if (typeof input.enabled !== "boolean")
        throw Error("Invalid enabled state.");
      await updateState((s) => {
        const source = s.sources.find((x) => x.id === input.id);
        if (!source) throw Error("Source not found.");
        source.enabled = input.enabled;
        source.revision++;
        return s;
      });
      return json(res, 200, { ok: true });
    }
    if (input.action === "pause") {
      if (typeof input.paused !== "boolean")
        throw Error("Invalid pause state.");
      await updateState((s) => {
        s.paused = input.paused;
        s.revision++;
        return s;
      });
      return json(res, 200, { ok: true });
    }
    if (input.action === "set-wallet") {
      if (!addressValid(input.wallet))
        throw Error("Use a valid public Solana address.");
      const rpc = createRpc();
      if ((await rpc("getGenesisHash")) !== MAINNET_GENESIS)
        throw Error("Mainnet identity mismatch.");
      const startSlot = await rpc("getSlot", [{ commitment: "finalized" }]);
      if (!Number.isSafeInteger(startSlot) || startSlot <= 0)
        throw Error("Finalized slot unavailable.");
      await updateState((s) => {
        if (s.identitySettings?.wallet === input.wallet) return null;
        s.identitySettings = { wallet: input.wallet, startSlot };
        s.launchState = null;
        s.watchLease = null;
        s.watchBucket = null;
        s.watchAt = null;
        s.watchStatus = "watching";
        return s;
      });
      return json(res, 200, { ok: true, startSlot });
    }
    throw Error("Invalid operation.");
  } catch (e) {
    const known =
      /^(Use |Invalid |This |Only public|Source not found|Public repository|GitHub rate)/.test(
        e.message,
      );
    return json(res, known ? 400 : 503, {
      error: known
        ? e.message
        : "Operation unavailable. Stored evidence has not been replaced.",
    });
  }
}
