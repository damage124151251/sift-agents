import { createHash } from "node:crypto";
const rules = [
  [
    "interface",
    "Interfaces changed",
    (p) => /(^|\/)(idl|idls|interfaces)(\/|$)|\.proto$/i.test(p),
  ],
  [
    "dependencies",
    "Dependency files changed",
    (p) =>
      /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.(toml|lock)|requirements[^/]*\.txt|go\.(mod|sum))$/i.test(
        p,
      ),
  ],
  [
    "automation",
    "Automation files changed",
    (p) => /^\.github\/workflows\/|(^|\/)(Dockerfile|Makefile)$/i.test(p),
  ],
  [
    "docs",
    "Documentation changed",
    (p) => /\.(md|mdx|rst)$/i.test(p) || /^docs\//i.test(p),
  ],
  [
    "tests",
    "Test files changed",
    (p) => /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\./i.test(p),
  ],
];
export function inspect(input) {
  const findings = rules
    .map(([id, label, test]) => ({
      id,
      label,
      paths: input.files.filter((f) => test(f.path)).map((f) => f.path),
    }))
    .filter((f) => f.paths.length)
    .map((f) => ({ ...f, count: f.paths.length }));
  const removed = input.files.filter((f) => f.status === "removed");
  if (removed.length)
    findings.unshift({
      id: "removed",
      label: "Files removed",
      count: removed.length,
      paths: removed.map((f) => f.path),
    });
  const additions = input.files.reduce((n, f) => n + f.additions, 0),
    deletions = input.files.reduce((n, f) => n + f.deletions, 0);
  if (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions))
    throw Error("Change totals exceed the supported range.");
  const attention =
    input.truncated ||
    findings.some((f) =>
      ["interface", "dependencies", "automation", "removed"].includes(f.id),
    );
  return {
    findings,
    additions,
    deletions,
    attention,
    summary: `${input.files.length} file records inspected. ${additions} added lines and ${deletions} removed lines in the returned metadata. ${attention ? "Review the highlighted changes." : "No configured attention rule matched."}`,
  };
}
export function publish(input, analysis, at) {
  const evidence = {
      repo: input.repo,
      head: input.head,
      base: input.base,
      files: input.files,
      truncated: input.truncated,
    },
    inputHash = createHash("sha256")
      .update(JSON.stringify(evidence))
      .digest("hex");
  const id = createHash("sha256")
    .update(`${input.repo}\n${input.base || "baseline"}\n${input.head}`)
    .digest("hex")
    .slice(0, 24);
  return {
    ...input,
    ...analysis,
    id,
    inputHash,
    createdAt: at,
    etag: undefined,
  };
}
