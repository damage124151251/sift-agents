import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Github,
  KeyRound,
  RefreshCw,
  Plus,
  Play,
  Pause,
  ArrowUpRight,
  ChevronRight,
  Check,
  Search,
  Download,
  FileText,
  Radio,
  Settings2,
  GitCommitHorizontal,
  Clock3,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Workflow,
} from "lucide-react";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/silkscreen/400.css";
import { AGENTS, GITHUB_URL } from "./config.mjs";
import {
  Canvas,
  Mark,
  IconButton,
  CopyButton,
  External,
  Modal,
  Intro,
  useReducedMotion,
} from "./components.jsx";
import { drawAgent, drawWorkbench } from "./art.mjs";
import {
  normalizeRepo,
  addressValid,
  shortSha,
  reportMarkdown,
} from "./domain.mjs";
import Protocol from "./Protocol.jsx";
import "./style.css";
const stamp = (s) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "Not yet";
const age = (s) => {
  if (!s) return "Awaiting first check";
  const n = Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 1000));
  return n < 60
    ? `${n}s ago`
    : n < 3600
      ? `${Math.floor(n / 60)}m ago`
      : `${Math.floor(n / 3600)}h ago`;
};
const short = (s) => (s ? `${s.slice(0, 5)}...${s.slice(-5)}` : "--");
async function request(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    signal: AbortSignal.timeout(58000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request unavailable.");
  return d;
}
function download(value, name, type = "application/json") {
  const blob = new Blob(
      [type === "application/json" ? JSON.stringify(value, null, 2) : value],
      { type },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [view, setView] = useState("workroom"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [operator, setOperator] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [replay, setReplay] = useState(null),
    [tick, setTick] = useState(0);
  const [intro, setIntro] = useState(() => {
    try {
      return (
        !matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !sessionStorage.getItem("sift-arrived")
      );
    } catch {
      return false;
    }
  });
  const reduced = useReducedMotion(),
    head = useRef(),
    fetching = useRef(false),
    stateRef = useRef(null);
  stateRef.current = data;
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const d = await request("/api/status");
      setData(d);
      setError("");
    } catch {
      setError(
        "Source connection unavailable. Last received records remain visible.",
      );
    } finally {
      fetching.current = false;
    }
  }, []);
  useEffect(() => {
    refresh();
    let n = 0;
    const timer = setInterval(() => {
      setTick((v) => v + 1);
      n++;
      if (
        !document.hidden &&
        (stateRef.current?.running ? n % 2 === 0 : n % 30 === 0)
      )
        refresh();
    }, 1000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (!replay) return;
    const timer = setTimeout(() => setReplay(null), 7200);
    return () => clearTimeout(timer);
  }, [replay]);
  const nav = (v) => {
    setView(v);
    setReplay(null);
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => head.current?.focus(), 0);
  };
  const finish = () => {
    try {
      sessionStorage.setItem("sift-arrived", "1");
    } catch {}
    setIntro(false);
    setTimeout(() => head.current?.focus(), 0);
  };
  const runs = data?.runs || [],
    reports = data?.reports || [],
    sources = data?.sources || [],
    selectedRun =
      runs.find((r) => r.id === selected) ||
      runs.find((r) => r.reportId) ||
      runs[0],
    report = reports.find((r) => r.id === selectedRun?.reportId),
    active = runs.find((r) => r.status === "running");
  const replayStage = replay
      ? AGENTS[Math.min(2, Math.floor((Date.now() - replay.started) / 2400))].id
      : null,
    stage = replayStage || active?.stage || null;
  const act = async (input) => {
    if (!operator) {
      setModal({ type: "auth" });
      return false;
    }
    setBusy(true);
    try {
      const result = await request("/api/operator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${operator}`,
        },
        body: JSON.stringify(input),
      });
      await refresh();
      setNotice(
        result.skipped
          ? result.reason || "No new work to perform."
          : "Changes recorded.",
      );
      return true;
    } catch (e) {
      setNotice(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const goodSchedule =
    data?.lastScheduledCompletion &&
    Date.now() - Date.parse(data.lastScheduledCompletion) < 22 * 60000;
  const identity = data?.identity || {},
    github = identity.github || GITHUB_URL;
  return (
    <>
      <div className="app" inert={intro ? true : undefined}>
        <header className="masthead">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              nav("workroom");
            }}
          >
            <Mark />
            <span>SIFT</span>
          </a>
          <nav aria-label="Main navigation">
            {["workroom", "runs", "sources", "protocol"].map((v) => (
              <button
                key={v}
                className={v === view ? "active" : ""}
                aria-current={v === view ? "page" : undefined}
                onClick={() => nav(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            {github && (
              <a
                className="github-link"
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SIFT source on GitHub"
              >
                <Github size={17} />
                <span>GitHub</span>
              </a>
            )}
            <IconButton
              title={operator ? "Operator session" : "Operator access"}
              onClick={() => setModal({ type: operator ? "session" : "auth" })}
            >
              <KeyRound size={17} />
            </IconButton>
          </div>
        </header>
        <div className="statusline">
          <span>
            <i className={data?.running ? "live" : ""} />
            {error
              ? "Connection interrupted"
              : data?.paused
                ? "Workroom paused"
                : data?.running
                  ? "Agents at work"
                  : goodSchedule
                    ? "Scheduled agents online"
                    : "Repository observation"}
          </span>
          <span>
            {data?.lastCompleted
              ? `Last check ${age(data.lastCompleted)}`
              : "First check pending"}
          </span>
          <button onClick={() => setModal({ type: "token" })}>
            <Radio size={12} />
            CA <b>{identity.tokenCA ? short(identity.tokenCA) : "soon"}</b>
            <ChevronRight size={11} />
          </button>
        </div>
        <main>
          <div className="page-heading">
            <div>
              <span className="kicker">
                {view === "workroom"
                  ? "A SMALL TEAM, ON THE JOB."
                  : `SIFT / ${view.toUpperCase()}`}
              </span>
              <h1 ref={head} tabIndex={-1}>
                {view === "workroom"
                  ? "Signals, sorted."
                  : view === "runs"
                    ? "Work leaves a trail."
                    : view === "sources"
                      ? "Straight from the source."
                      : "How SIFT works."}
              </h1>
            </div>
            <div className="heading-actions">
              {view === "sources" ? (
                <button
                  className="primary"
                  onClick={() =>
                    setModal({ type: operator ? "source" : "auth" })
                  }
                >
                  <Plus size={14} />
                  Connect source
                </button>
              ) : view !== "protocol" ? (
                <>
                  <IconButton title="Refresh records" onClick={refresh}>
                    <RefreshCw size={16} />
                  </IconButton>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => act({ action: "run" })}
                  >
                    <Play size={13} />
                    {busy ? "Running..." : "Run a check"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              {error}
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {view === "workroom" && (
            <>
              <section className="workbench">
                <div className="bench-caption">
                  <span>
                    <span className="square-blue" />
                    THE WORKROOM
                  </span>
                  <span>
                    {replay
                      ? "Historical run replay"
                      : active
                        ? `Processing ${active.repo}`
                        : data?.paused
                          ? "Paused"
                          : "Ready for the next revision"}
                  </span>
                  <IconButton
                    title="Replay opening"
                    onClick={() => setIntro(true)}
                  >
                    <RotateCcw size={13} />
                  </IconButton>
                </div>
                <Canvas
                  animate
                  label="Three pixel agents operating a scanner, inspection desk and report printer"
                  className="workbench-canvas"
                  draw={(c, w, h, t) =>
                    drawWorkbench(c, w, h, {
                      time: t,
                      stage,
                      selected: AGENTS.findIndex((a) => a.id === stage),
                      reduced,
                    })
                  }
                />
                <div className="agent-strip">
                  {AGENTS.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        setModal({ type: "agent", agent: a, index: i })
                      }
                      className={stage === a.id ? "working" : ""}
                    >
                      <span
                        className="agent-index"
                        style={{ background: a.color }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>
                          {a.name} <small>/ {a.role}</small>
                        </strong>
                        <span className="agent-task">{a.task}</span>
                      </span>
                      <span className="agent-status">
                        {stage === a.id
                          ? replay
                            ? "replay"
                            : "working"
                          : "ready"}
                        <i />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="counts">
                <div>
                  <span>Connected sources</span>
                  <strong>
                    {sources.filter((s) => s.enabled).length}
                    <small> / {sources.length}</small>
                  </strong>
                </div>
                <div>
                  <span>Recorded runs</span>
                  <strong>{runs.length.toString().padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>Published reports</span>
                  <strong>{reports.length.toString().padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>Check interval</span>
                  <strong>
                    10<small> min</small>
                  </strong>
                </div>
              </div>
              <div className="output-layout">
                <section className="run-section">
                  <div className="section-head">
                    <h2>The job board</h2>
                    <button className="text-button" onClick={() => nav("runs")}>
                      All runs <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <RunList
                    runs={runs.slice(0, 6)}
                    selected={selectedRun?.id}
                    onSelect={setSelected}
                  />
                  <div className="event-preview">
                    <div className="section-head">
                      <h3>Latest handoffs</h3>
                      <span>Server records</span>
                    </div>
                    {(data?.events || []).slice(0, 4).map((e) => (
                      <div className="handoff" key={e.id}>
                        <i
                          className={e.status === "blocked" ? "blocked" : ""}
                        />
                        <span>
                          <b>
                            {AGENTS.find((a) => a.id === e.stage)?.name ||
                              e.stage}
                          </b>{" "}
                          {e.detail}
                        </span>
                        <time>
                          {new Date(e.at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </time>
                      </div>
                    ))}
                    {!data?.events?.length && (
                      <p className="quiet-empty">
                        No stage events recorded yet.
                      </p>
                    )}
                  </div>
                </section>
                <section className="report-section">
                  <div className="section-head">
                    <h2>The output</h2>
                    {report && (
                      <span className="report-stamp">
                        {report.mode === "baseline" ? "Baseline" : "Comparison"}
                      </span>
                    )}
                  </div>
                  <ReportPreview
                    report={report}
                    run={selectedRun}
                    onOpen={() => setModal({ type: "report", report })}
                    onReplay={() => {
                      if (selectedRun?.status === "completed")
                        setReplay({ run: selectedRun.id, started: Date.now() });
                    }}
                  />
                </section>
              </div>
            </>
          )}
          {view === "runs" && (
            <>
              <div className="filters">
                <div className="segmented" aria-label="Run filter">
                  {["all", "completed", "unchanged", "blocked"].map((v) => (
                    <button
                      key={v}
                      aria-pressed={filter === v}
                      onClick={() => setFilter(v)}
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={14} />
                  <input
                    aria-label="Search repository"
                    placeholder="Find a repository"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <IconButton
                  title="Export run history"
                  onClick={() =>
                    download(
                      { exportedAt: new Date().toISOString(), runs },
                      "sift-runs.json",
                    )
                  }
                >
                  <Download size={16} />
                </IconButton>
              </div>
              <div className="runs-layout">
                <RunList
                  runs={runs.filter(
                    (r) =>
                      (filter === "all" || r.status === filter) &&
                      r.repo.toLowerCase().includes(query.toLowerCase()),
                  )}
                  selected={selectedRun?.id}
                  onSelect={setSelected}
                />
                <section className="run-inspector">
                  {selectedRun ? (
                    <>
                      <div className="section-head">
                        <h2>Run details</h2>
                        <span className={`status-pill ${selectedRun.status}`}>
                          {selectedRun.status}
                        </span>
                      </div>
                      <h3 className="repo-heading">{selectedRun.repo}</h3>
                      <dl className="details">
                        <dt>Started</dt>
                        <dd>{stamp(selectedRun.startedAt)}</dd>
                        <dt>Finished</dt>
                        <dd>{stamp(selectedRun.finishedAt)}</dd>
                        <dt>Run ID</dt>
                        <dd>{selectedRun.id}</dd>
                      </dl>
                      <ol className="steps">
                        {selectedRun.steps.map((s) => (
                          <li key={s.stage}>
                            <span
                              className={
                                s.status === "blocked"
                                  ? "step-badge blocked"
                                  : "step-badge"
                              }
                            >
                              {s.status === "done" ? (
                                <Check size={13} />
                              ) : s.status === "running" ? (
                                <RefreshCw size={13} />
                              ) : (
                                <AlertCircle size={13} />
                              )}
                            </span>
                            <div>
                              <h4>
                                {AGENTS.find((a) => a.id === s.stage)?.name} /{" "}
                                {AGENTS.find((a) => a.id === s.stage)?.role}
                              </h4>
                              <p>{s.detail || s.status}</p>
                              <small>
                                {stamp(s.startedAt)}
                                {s.finishedAt
                                  ? ` - ${stamp(s.finishedAt)}`
                                  : ""}
                              </small>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {selectedRun.error && (
                        <p className="inline-error">{selectedRun.error}</p>
                      )}
                      {report && (
                        <button
                          className="primary"
                          onClick={() => setModal({ type: "report", report })}
                        >
                          <FileText size={14} />
                          Open report
                        </button>
                      )}
                    </>
                  ) : (
                    <Empty
                      title="No run selected"
                      text="Recorded jobs will appear here."
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {view === "sources" && (
            <>
              <div className="sources-list">
                {sources.map((s, i) => (
                  <div className="source-row" key={s.id}>
                    <span className="source-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="source-main">
                      <External href={`https://github.com/${s.repo}`}>
                        {s.repo}
                      </External>
                      <span>
                        {s.error ||
                          `Default branch / ${s.head ? shortSha(s.head) : "No checkpoint yet"}`}
                      </span>
                    </div>
                    <span className={`source-status ${s.status}`}>
                      {s.enabled ? s.status : "paused"}
                    </span>
                    <div className="source-meta">
                      <span>Last check</span>
                      <strong>{age(s.lastChecked)}</strong>
                    </div>
                    <IconButton
                      title={s.enabled ? `Pause ${s.repo}` : `Resume ${s.repo}`}
                      disabled={busy}
                      onClick={() =>
                        act({
                          action: "toggle-source",
                          id: s.id,
                          enabled: !s.enabled,
                        })
                      }
                    >
                      {s.enabled ? <Pause size={15} /> : <Play size={15} />}
                    </IconButton>
                  </div>
                ))}
              </div>
              <div className="sources-footer">
                <p>{sources.length} of 3 public repository slots connected.</p>
                <button
                  className="outline"
                  disabled={busy}
                  onClick={() =>
                    act({ action: "pause", paused: !data?.paused })
                  }
                >
                  {data?.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                  {data?.paused ? "Resume workroom" : "Pause workroom"}
                </button>
              </div>
              <div className="source-explainer">
                <Canvas
                  label="Pip the source collector"
                  draw={(c, w, h) => {
                    c.clearRect(0, 0, w, h);
                    drawAgent(c, w / 2, h - 10, 3, { kind: 0 });
                  }}
                />
                <div>
                  <h2>A source, not an endorsement.</h2>
                  <p>
                    Agents observe public repository changes. Read the report
                    alongside the original commit.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => nav("protocol")}
                  >
                    Coverage and rules <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
          {view === "protocol" && <Protocol />}
        </main>
        <footer>
          <a
            className="footer-brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              nav("workroom");
            }}
          >
            <Mark />
            SIFT
          </a>
          <span>Small agents. Clear signals.</span>
          <div className="footer-links">
            {github && (
              <External href={github}>
                <Github size={14} />
                GitHub
              </External>
            )}
            <button onClick={() => setModal({ type: "token" })}>
              <Radio size={13} />
              Token monitor
            </button>
            <button onClick={() => nav("protocol")}>Protocol</button>
          </div>
          <span className="footer-ca">
            CA{" "}
            {identity.tokenCA ? (
              <>
                <External href={`https://solscan.io/token/${identity.tokenCA}`}>
                  {short(identity.tokenCA)}
                </External>
                <CopyButton value={identity.tokenCA} />
              </>
            ) : (
              <b>soon</b>
            )}
          </span>
        </footer>
      </div>
      {intro && <Intro onDone={finish} />}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal?.type === "auth" && (
        <Auth
          onClose={() => setModal(null)}
          onSuccess={(key) => {
            setOperator(key);
            setModal(null);
            setNotice("Operator controls unlocked.");
          }}
        />
      )}
      {modal?.type === "session" && (
        <Modal title="Operator session" onClose={() => setModal(null)}>
          <p className="dialog-copy">
            Controls are unlocked in this tab only. This key is not a wallet
            key.
          </p>
          <button
            className="primary full"
            onClick={() => {
              setOperator("");
              setModal(null);
            }}
          >
            Lock controls
          </button>
        </Modal>
      )}
      {modal?.type === "source" && (
        <AddSource
          busy={busy}
          onClose={() => setModal(null)}
          onAdd={async (repo) => {
            if (await act({ action: "add-source", repo })) setModal(null);
          }}
        />
      )}
      {modal?.type === "report" && (
        <ReportModal report={modal.report} onClose={() => setModal(null)} />
      )}
      {modal?.type === "agent" && (
        <Modal
          title={`${modal.agent.name} / ${modal.agent.role}`}
          onClose={() => setModal(null)}
        >
          <Canvas
            animate
            className="agent-portrait"
            label={`${modal.agent.name} pixel agent`}
            draw={(c, w, h, t) => {
              c.clearRect(0, 0, w, h);
              drawAgent(c, w / 2, h - 12, 4, {
                kind: modal.index,
                time: t,
                working: stage === modal.agent.id,
              });
            }}
          />
          <p className="dialog-copy">
            {
              [
                "Pip retrieves public repository revisions and file-change evidence from GitHub. Missing data stops the job without advancing its checkpoint.",
                "Dot applies deterministic file-path rules to the collected metadata. Interface, dependency, automation and removed-file changes are highlighted for review.",
                "Bit writes a structured, source-linked report and a SHA-256 checksum of its inputs. No report is published unless collection and inspection complete.",
              ][modal.index]
            }
          </p>
          <dl className="details">
            <dt>Execution</dt>
            <dd>Server-side / rule-based</dd>
            <dt>Current state</dt>
            <dd>
              {stage === modal.agent.id
                ? replay
                  ? "Historical replay"
                  : "Working"
                : "Ready"}
            </dd>
          </dl>
        </Modal>
      )}
      {modal?.type === "token" && (
        <TokenMonitor
          identity={identity}
          operator={operator}
          busy={busy}
          act={act}
          onClose={() => setModal(null)}
          onAuth={() => setModal({ type: "auth" })}
        />
      )}
    </>
  );
}
function Empty({ title, text }) {
  return (
    <div className="empty">
      <Workflow size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function RunList({ runs, selected, onSelect }) {
  return (
    <div className="run-list">
      {runs.length ? (
        runs.map((r) => (
          <button
            className={`run-row ${r.id === selected ? "selected" : ""}`}
            onClick={() => onSelect(r.id)}
            key={r.id}
          >
            <span className={`run-indicator ${r.status}`}>
              {r.status === "completed" ? (
                <Check size={14} />
              ) : r.status === "blocked" ? (
                <AlertCircle size={14} />
              ) : r.status === "running" ? (
                <RefreshCw size={14} />
              ) : (
                <GitCommitHorizontal size={14} />
              )}
            </span>
            <span className="run-text">
              <strong>{r.repo}</strong>
              <small>
                {r.status === "completed"
                  ? "Report published"
                  : r.status === "unchanged"
                    ? "No new revision"
                    : r.status === "running"
                      ? "Agents at work"
                      : r.error || r.status}
              </small>
            </span>
            <span className="run-age">{age(r.finishedAt || r.startedAt)}</span>
            <ChevronRight size={13} />
          </button>
        ))
      ) : (
        <Empty
          title="No matching runs."
          text="Checks are recorded here when agents execute."
        />
      )}
    </div>
  );
}
function ReportPreview({ report: r, run, onOpen, onReplay }) {
  return (
    <div className="report-preview">
      {r ? (
        <>
          <div className="paper-header">
            <FileText size={16} />
            <span>SIFT REPORT</span>
            <code>#{r.id.slice(0, 8)}</code>
          </div>
          <h3>{r.title}</h3>
          <span className="report-source">
            {r.repo} / {shortSha(r.head)}
          </span>
          <p>{r.summary}</p>
          <div className="report-counts">
            <strong>
              {r.files.length}
              <span>files</span>
            </strong>
            <strong className="additions">
              +{r.additions}
              <span>lines</span>
            </strong>
            <strong className="deletions">
              -{r.deletions}
              <span>lines</span>
            </strong>
          </div>
          <ul className="findings">
            {r.findings.slice(0, 3).map((f) => (
              <li key={f.id}>
                <span>{f.label}</span>
                <b>{f.count}</b>
              </li>
            ))}
          </ul>
          <div className="report-preview-actions">
            <button className="primary" onClick={onOpen}>
              Read report <ArrowUpRight size={13} />
            </button>
            <IconButton
              title="Replay this completed workflow"
              onClick={onReplay}
            >
              <Play size={14} />
            </IconButton>
            <IconButton
              title="Download report as Markdown"
              onClick={() =>
                download(reportMarkdown(r), `sift-${r.id}.md`, "text/markdown")
              }
            >
              <Download size={14} />
            </IconButton>
          </div>
        </>
      ) : (
        <Empty
          title={
            run?.status === "blocked"
              ? "Report not published."
              : "A report starts with a source."
          }
          text={
            run?.error ||
            "Completed checks with a new revision produce a source-linked report."
          }
        />
      )}
    </div>
  );
}
function ReportModal({ report: r, onClose }) {
  return (
    <Modal title="Source report" wide onClose={onClose}>
      <div className="report-title">
        <span className="report-stamp">
          {r.mode} {r.truncated ? "/ limited coverage" : ""}
        </span>
        <h3>{r.title}</h3>
        <External href={r.url}>
          {r.repo} / {shortSha(r.head)}
        </External>
      </div>
      <p className="dialog-copy">{r.summary}</p>
      <dl className="details">
        <dt>Observed</dt>
        <dd>{stamp(r.createdAt)}</dd>
        <dt>Head</dt>
        <dd>{r.head}</dd>
        <dt>Base</dt>
        <dd>{r.base || "Latest commit baseline"}</dd>
        <dt>Input SHA-256</dt>
        <dd>{r.inputHash}</dd>
      </dl>
      <p className="coverage-note">{r.coverage}</p>
      <div className="file-list">
        <div className="file-heading">
          <span>Changed file</span>
          <span>Lines</span>
        </div>
        {r.files.map((f) => (
          <div className="file-row" key={f.path}>
            <span>
              <b>{f.status}</b>
              <code>{f.path}</code>
            </span>
            <span>
              <i>+{f.additions}</i>
              <em>-{f.deletions}</em>
            </span>
          </div>
        ))}
      </div>
      <div className="dialog-actions">
        <button
          className="primary"
          onClick={() =>
            download(reportMarkdown(r), `sift-${r.id}.md`, "text/markdown")
          }
        >
          <Download size={14} />
          Markdown
        </button>
        <button
          className="outline"
          onClick={() => download(r, `sift-${r.id}.json`)}
        >
          <Download size={14} />
          JSON
        </button>
      </div>
      <p className="fineprint">
        Metadata analysis. Not a security audit or code correctness assessment.
      </p>
    </Modal>
  );
}
function Auth({ onClose, onSuccess }) {
  const [key, set] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Operator access" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await request("/api/operator", {
              headers: { Authorization: `Bearer ${key.trim()}` },
            });
            onSuccess(key.trim());
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="dialog-copy">
          The workroom is public. Source and watcher controls require the
          operator key.
        </p>
        <label>
          Operator key
          <input
            autoFocus
            type="password"
            autoComplete="off"
            required
            minLength={32}
            value={key}
            onChange={(e) => set(e.target.value)}
          />
        </label>
        <p className="fineprint">Never enter a wallet seed or private key.</p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          <KeyRound size={14} />
          {busy ? "Checking..." : "Unlock controls"}
        </button>
      </form>
    </Modal>
  );
}
function AddSource({ busy, onClose, onAdd }) {
  const [repo, set] = useState(""),
    [error, setError] = useState("");
  return (
    <Modal title="Connect a public source" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const normalized = normalizeRepo(repo);
            setError("");
            onAdd(normalized);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <label>
          GitHub repository
          <input
            required
            placeholder="owner/repository"
            autoFocus
            value={repo}
            onChange={(e) => set(e.target.value)}
          />
        </label>
        <p className="fineprint">
          The source and its reports will be public. Only the default branch is
          monitored.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          <Plus size={14} />
          {busy ? "Checking repository..." : "Connect source"}
        </button>
      </form>
    </Modal>
  );
}
function TokenMonitor({ identity, operator, busy, act, onClose, onAuth }) {
  const [wallet, setWallet] = useState(identity.wallet || ""),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Token monitor" onClose={onClose}>
      <div className="monitor-state">
        <Radio size={20} />
        <span>
          {identity.tokenCA
            ? "Contract detected"
            : identity.wallet
              ? "Watching for a SIFT launch"
              : "Awaiting a development wallet"}
        </span>
      </div>
      <dl className="details">
        <dt>Contract address</dt>
        <dd>
          {identity.tokenCA ? (
            <span className="copy-value">
              {identity.tokenCA}
              <CopyButton value={identity.tokenCA} />
            </span>
          ) : (
            "soon"
          )}
        </dd>
        <dt>Watcher</dt>
        <dd>{identity.watchStatus || "unconfigured"}</dd>
        <dt>Last check</dt>
        <dd>{stamp(identity.checkedAt)}</dd>
        <dt>Activation slot</dt>
        <dd>{identity.startSlot || "Not configured"}</dd>
      </dl>
      {identity.tokenCA && (
        <External href={`https://solscan.io/token/${identity.tokenCA}`}>
          Token on Solscan
        </External>
      )}
      {identity.proof && (
        <External href={`https://solscan.io/tx/${identity.proof.signature}`}>
          Launch receipt
        </External>
      )}
      {operator ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!addressValid(wallet)) {
              setError("Use a valid public Solana address.");
              return;
            }
            setError("");
            if (!confirm) {
              setConfirm(true);
              return;
            }
            if (await act({ action: "set-wallet", wallet })) {
              setConfirm(false);
              onClose();
            }
          }}
        >
          <label>
            Dev wallet
            <input
              value={wallet}
              onChange={(e) => {
                setWallet(e.target.value);
                setConfirm(false);
              }}
              required
              maxLength={44}
              spellCheck="false"
            />
          </label>
          {confirm && (
            <p className="coverage-note">
              This starts a new discovery window from the current finalized
              slot. Only future SIFT launches by this wallet qualify. No funds
              will move.
            </p>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Activating..."
              : confirm
                ? "Activate watcher"
                : "Review wallet"}
          </button>
        </form>
      ) : (
        <>
          <p className="fineprint">
            The CA appears after a matching Pump creation and initialized mint
            are verified. A development wallet is not a token address.
          </p>
          {identity.wallet && (
            <div className="wallet-value">
              <code>{identity.wallet}</code>
              <CopyButton value={identity.wallet} />
            </div>
          )}
          <button className="outline full" onClick={onAuth}>
            <Settings2 size={14} />
            Operator settings
          </button>
        </>
      )}
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
