export function source(repo, id) {
  return {
    id,
    repo,
    enabled: true,
    revision: 1,
    createdAt: new Date().toISOString(),
    lastChecked: null,
    head: null,
    etag: null,
    lastReport: null,
    status: "waiting",
    error: null,
  };
}
export function initialState() {
  return {
    version: 1,
    revision: 1,
    paused: false,
    lease: null,
    lastBucket: null,
    lastAttempt: null,
    lastCompleted: null,
    lastScheduledCompletion: null,
    cycleCount: 0,
    sources: [
      source("pump-fun/pump-public-docs", "pump-docs"),
      source("anza-xyz/kit", "solana-kit"),
    ],
    runs: [],
    reports: [],
    events: [],
    identitySettings: null,
    watchStatus: "unconfigured",
  };
}
