import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRepo, reportMarkdown } from "../src/domain.mjs";
import { createGitHub, collect, verifyRepo } from "../server/github.mjs";
import { inspect, publish } from "../server/analyze.mjs";
import { initialState, source } from "../server/config.mjs";
import { tick } from "../server/worker.mjs";
import { authorized } from "../server/http.mjs";
const A = "a".repeat(40),
  B = "b".repeat(40),
  C = "c".repeat(40);
const files = [
  {
    filename: "idl/pump.json",
    status: "modified",
    additions: 12,
    deletions: 4,
  },
  { filename: "package.json", status: "modified", additions: 2, deletions: 1 },
  {
    filename: ".github/workflows/ci.yml",
    status: "removed",
    additions: 0,
    deletions: 24,
  },
];
const input = {
  repo: "example/project",
  head: B,
  base: A,
  mode: "comparison",
  title: "A real revision",
  url: `https://github.com/example/project/compare/${A}...${B}`,
  files: files.map((f) => ({
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  })),
  coverage: "Returned metadata.",
  truncated: false,
};
function github(path) {
  if (path.includes("/commits?"))
    return {
      data: [
        {
          sha: B,
          commit: {
            message: "A real revision\nMore text",
            committer: { date: "2026-10-01T00:00:00Z" },
          },
        },
      ],
      etag: '"new"',
    };
  if (path.includes("/compare/"))
    return {
      data: {
        status: "ahead",
        base_commit: { sha: A },
        merge_base_commit: { sha: A },
        files,
      },
      hasNext: false,
    };
  return { data: { sha: B, files }, hasNext: false };
}
function memory(s) {
  return {
    value: s,
    async update(fn) {
      const next = await fn(structuredClone(this.value));
      if (next) this.value = next;
      return structuredClone(this.value);
    },
  };
}
test("repository parsing rejects arbitrary hosts, credentials and extra path segments", () => {
  assert.equal(
    normalizeRepo("https://github.com/pump-fun/pump-public-docs/"),
    "pump-fun/pump-public-docs",
  );
  for (const value of [
    "http://localhost/a",
    "https://evil.test/a/b",
    "https://github.com/a/b?x=1",
    "https://me:secret@github.com/a/b",
    "a/b/issues",
    "a/..",
    "../repo",
    "a/b#frag",
  ])
    assert.throws(() => normalizeRepo(value));
});
test("private repositories and mismatched identity cannot be registered", async () => {
  await assert.rejects(() =>
    verifyRepo("example/project", async () => ({
      data: { private: true, full_name: "example/project" },
    })),
  );
  await assert.rejects(() =>
    verifyRepo("example/project", async () => ({
      data: { private: false, full_name: "other/repo" },
    })),
  );
  assert.equal(
    await verifyRepo("Example/Project", async () => ({
      data: { private: false, full_name: "example/project" },
    })),
    "example/project",
  );
});
test("baseline is latest commit only and retains exact source identity", async () => {
  const s = source("example/project", "s");
  const r = await collect(s, github);
  assert.equal(r.mode, "baseline");
  assert.equal(r.head, B);
  assert.equal(r.base, null);
  assert.equal(r.files.length, 3);
  assert.match(r.coverage, /Latest commit only/);
});
test("comparison is pinned to previous checkpoint and exposes evidence", async () => {
  const s = { ...source("example/project", "s"), head: A };
  const r = await collect(s, github);
  assert.equal(r.mode, "comparison");
  assert.equal(r.base, A);
  assert.ok(r.url.endsWith(`${A}...${B}`));
});
test("history divergence stops checkpoint advancement", async () => {
  await assert.rejects(
    () =>
      collect({ ...source("example/project", "s"), head: A }, async (path) =>
        path.includes("/compare/")
          ? {
              data: {
                status: "diverged",
                base_commit: { sha: A },
                merge_base_commit: { sha: C },
                files,
              },
            }
          : github(path),
      ),
    /diverged/,
  );
});
test("unchanged response requires an existing valid checkpoint", async () => {
  await assert.rejects(
    () =>
      collect(source("example/project", "s"), async () => ({
        unchanged: true,
      })),
    /checkpoint/,
  );
  assert.equal(
    (
      await collect(
        { ...source("example/project", "s"), head: B },
        async () => ({ unchanged: true }),
      )
    ).unchanged,
    true,
  );
});
test("malformed file metadata is not converted into fake counts", async () => {
  await assert.rejects(
    () =>
      collect(source("example/project", "s"), async (path) =>
        path.includes("/commits?")
          ? github(path)
          : { data: { sha: B, files: [{ ...files[0], additions: -1 }] } },
      ),
    /evidence/,
  );
});
test("pagination or limit-sized results are explicitly marked incomplete", async () => {
  const r = await collect(source("example/project", "s"), async (path) =>
    path.includes("/commits?")
      ? github(path)
      : { data: { sha: B, files }, hasNext: true },
  );
  assert.equal(r.truncated, true);
  assert.match(r.coverage, /incomplete/);
});
test("rules classify observable paths without claiming semantic correctness", () => {
  const a = inspect(input);
  assert.equal(a.additions, 14);
  assert.equal(a.deletions, 29);
  assert.equal(a.attention, true);
  assert.deepEqual(
    a.findings.map((f) => f.id),
    ["removed", "interface", "dependencies", "automation"],
  );
  assert.doesNotMatch(a.summary, /secure|safe|audit passed/);
});
test("report identity is stable and input hash changes with evidence", () => {
  const a = inspect(input),
    r = publish(input, a, "now"),
    again = publish(input, a, "later");
  assert.equal(r.id, again.id);
  assert.equal(r.inputHash, again.inputHash);
  const changed = publish(
    { ...input, files: [] },
    inspect({ ...input, files: [] }),
    "now",
  );
  assert.notEqual(changed.inputHash, r.inputHash);
  assert.match(reportMarkdown(r), /Input SHA-256/);
  assert.match(reportMarkdown(r), /Not a security audit/);
});
test("worker writes real stage transitions, final report and checkpoint atomically", async () => {
  const store = memory({
      ...initialState(),
      sources: [source("example/project", "s")],
    }),
    now = () => 1790838000000;
  await tick({ store: store.update.bind(store), github, now });
  assert.equal(store.value.runs[0].status, "completed");
  assert.deepEqual(
    store.value.runs[0].steps.map((s) => s.status),
    ["done", "done", "done"],
  );
  assert.equal(store.value.reports.length, 1);
  assert.equal(store.value.sources[0].head, B);
  assert.equal(store.value.events.length, 6);
  assert.ok(store.value.lastScheduledCompletion);
});
test("same schedule bucket is not executed twice", async () => {
  const store = memory({
      ...initialState(),
      sources: [source("example/project", "s")],
    }),
    now = () => 1790838000000;
  await tick({ store: store.update.bind(store), github, now });
  const result = await tick({
    store: store.update.bind(store),
    github: () => {
      throw Error("duplicate");
    },
    now,
  });
  assert.equal(result.skipped, true);
  assert.equal(store.value.reports.length, 1);
});
test("unchanged revision records a check without duplicating a report", async () => {
  const store = memory({
    ...initialState(),
    sources: [{ ...source("example/project", "s"), head: B }],
  });
  await tick({ store: store.update.bind(store), github });
  assert.equal(store.value.runs[0].status, "unchanged");
  assert.equal(store.value.reports.length, 0);
});
test("missing source data produces blocked run without moving checkpoint", async () => {
  const store = memory({
    ...initialState(),
    sources: [{ ...source("example/project", "s"), head: A }],
  });
  await tick({
    store: store.update.bind(store),
    github: async () => {
      throw Error("unavailable");
    },
  });
  assert.equal(store.value.runs[0].status, "blocked");
  assert.equal(store.value.sources[0].head, A);
  assert.equal(store.value.reports.length, 0);
});
test("pause during collection prevents publication", async () => {
  const store = memory({
    ...initialState(),
    sources: [source("example/project", "s")],
  });
  await tick({
    store: store.update.bind(store),
    github: async (path) => {
      store.value.paused = true;
      store.value.revision++;
      return github(path);
    },
  });
  assert.equal(store.value.reports.length, 0);
  assert.equal(store.value.sources[0].head, null);
  assert.equal(store.value.runs[0].status, "blocked");
});
test("public GitHub client does not send privileged credentials and rejects rate limits", async () => {
  let headers;
  const api = createGitHub({
    fetcher: async (url, options) => {
      headers = options.headers;
      assert.ok(url.startsWith("https://api.github.com/repos/"));
      return new Response("{}", { status: 429 });
    },
  });
  await assert.rejects(() => api("/repos/example/project"), /rate limit/);
  assert.equal(headers.Authorization, undefined);
});
test("operator credentials are exact and required", () => {
  const secret = "x".repeat(40);
  assert.equal(
    authorized({ headers: { authorization: `Bearer ${secret}` } }, secret),
    true,
  );
  assert.equal(authorized({ headers: {} }, secret), false);
  assert.equal(
    authorized({ headers: { authorization: "Bearer small" } }, "small"),
    false,
  );
});
