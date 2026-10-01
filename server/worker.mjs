import { randomUUID } from "node:crypto";
import { updateState } from "./store.mjs";
import { createGitHub, collect } from "./github.mjs";
import { inspect, publish } from "./analyze.mjs";
export async function tick({
  store = updateState,
  github = createGitHub(),
  now = Date.now,
  manual = false,
} = {}) {
  const started = now(),
    id = randomUUID(),
    bucket = Math.floor(started / 600000);
  const acquired = await store((s) => {
    if (s.lease?.until > started || s.lastBucket === bucket) return null;
    s.lease = { id, until: started + 90000 };
    s.lastAttempt = new Date(started).toISOString();
    s.runs = s.runs.map((r) =>
      r.status === "running"
        ? {
            ...r,
            status: "interrupted",
            finishedAt: s.lastAttempt,
            error: "Previous worker expired before completion.",
          }
        : r,
    );
    return s;
  });
  if (acquired.lease?.id !== id)
    return {
      skipped: true,
      reason: "This ten-minute cycle is already running or completed.",
    };
  const stamp = () => new Date(now()).toISOString();
  async function save(fn) {
    return store((s) => {
      if (s.lease?.id !== id || s.lease.until < now())
        throw Error("Worker lease expired.");
      return fn(s);
    });
  }
  function event(s, run, stage, status, detail) {
    s.events = [
      {
        id: randomUUID(),
        runId: run.id,
        repo: run.repo,
        stage,
        status,
        at: stamp(),
        detail,
      },
      ...s.events,
    ].slice(0, 180);
  }
  for (const source of acquired.paused
    ? []
    : acquired.sources.filter((s) => s.enabled)) {
    const run = {
      id: randomUUID(),
      sourceId: source.id,
      repo: source.repo,
      startedAt: stamp(),
      finishedAt: null,
      status: "running",
      stage: "scout",
      steps: [{ stage: "scout", status: "running", startedAt: stamp() }],
      reportId: null,
      error: null,
    };
    try {
      await save((s) => {
        if (
          s.paused ||
          s.revision !== acquired.revision ||
          !s.sources.some(
            (x) =>
              x.id === source.id && x.enabled && x.revision === source.revision,
          )
        )
          throw Error("Source paused or changed.");
        s.runs = [run, ...s.runs].slice(0, 80);
        event(
          s,
          run,
          "scout",
          "running",
          "Fetching the latest public revision.",
        );
        return s;
      });
      const input = await collect(source, github);
      if (input.unchanged) {
        await save((s) => {
          const r = s.runs.find((x) => x.id === run.id),
            current = s.sources.find((x) => x.id === source.id);
          if (!r) return null;
          r.status = "unchanged";
          r.finishedAt = stamp();
          r.steps[0] = {
            ...r.steps[0],
            status: "done",
            finishedAt: r.finishedAt,
            detail: "Revision matches the stored checkpoint.",
          };
          event(
            s,
            run,
            "scout",
            "unchanged",
            "No new revision. No duplicate report generated.",
          );
          if (current && current.revision === source.revision && !s.paused) {
            current.lastChecked = r.finishedAt;
            current.etag = input.etag;
            current.status = "current";
            current.error = null;
          }
          return s;
        });
        continue;
      }
      await save((s) => {
        const r = s.runs.find((x) => x.id === run.id);
        r.stage = "inspector";
        r.steps[0] = {
          ...r.steps[0],
          status: "done",
          finishedAt: stamp(),
          detail: `${input.files.length} file records fetched at ${input.head.slice(0, 7)}.`,
        };
        r.steps.push({
          stage: "inspector",
          status: "running",
          startedAt: stamp(),
        });
        event(s, run, "scout", "done", r.steps[0].detail);
        event(
          s,
          run,
          "inspector",
          "running",
          "Applying file-path and change-type rules.",
        );
        return s;
      });
      const analysis = inspect(input);
      await save((s) => {
        const r = s.runs.find((x) => x.id === run.id);
        r.stage = "scribe";
        r.steps[1] = {
          ...r.steps[1],
          status: "done",
          finishedAt: stamp(),
          detail: `${analysis.findings.length} change categories matched.`,
        };
        r.steps.push({
          stage: "scribe",
          status: "running",
          startedAt: stamp(),
        });
        event(s, run, "inspector", "done", r.steps[1].detail);
        event(
          s,
          run,
          "scribe",
          "running",
          "Writing a source-linked report and input checksum.",
        );
        return s;
      });
      const report = publish(input, analysis, stamp());
      await save((s) => {
        const r = s.runs.find((x) => x.id === run.id),
          current = s.sources.find((x) => x.id === source.id);
        if (
          s.paused ||
          s.revision !== acquired.revision ||
          !current?.enabled ||
          current.revision !== source.revision
        )
          throw Error("Source paused or changed.");
        if (!s.reports.some((x) => x.id === report.id))
          s.reports = [report, ...s.reports].slice(0, 90);
        current.head = input.head;
        current.etag = input.etag;
        current.lastChecked = stamp();
        current.lastReport = report.id;
        current.status = "current";
        current.error = null;
        r.status = "completed";
        r.finishedAt = stamp();
        r.reportId = report.id;
        r.steps[2] = {
          ...r.steps[2],
          status: "done",
          finishedAt: r.finishedAt,
          detail: `Report ${report.id.slice(0, 8)} published.`,
        };
        event(s, run, "scribe", "done", r.steps[2].detail);
        return s;
      });
    } catch (e) {
      await save((s) => {
        const r = s.runs.find((x) => x.id === run.id),
          current = s.sources.find((x) => x.id === source.id),
          message =
            /^(GitHub rate|Public repository|Repository history|Source paused|Source response)/.test(
              e.message,
            )
              ? e.message
              : "Source check incomplete. Previous checkpoint retained.";
        if (r) {
          r.status = "blocked";
          r.error = message;
          r.finishedAt = stamp();
          const step = r.steps.at(-1);
          step.status = "blocked";
          step.finishedAt = r.finishedAt;
          event(s, run, r.stage, "blocked", message);
        }
        if (current?.revision === source.revision && !s.paused) {
          current.status = "blocked";
          current.error = message;
        }
        return s;
      }).catch(() => {});
    }
  }
  const result = await save((s) => {
    s.lastBucket = bucket;
    s.lastCompleted = stamp();
    if (!manual) s.lastScheduledCompletion = s.lastCompleted;
    s.cycleCount++;
    s.lease = null;
    return s;
  });
  return {
    completedAt: result.lastCompleted,
    source: manual ? "operator" : "scheduler",
  };
}
