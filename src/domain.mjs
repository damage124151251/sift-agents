import bs58 from "bs58";
export function addressValid(s) {
  try {
    return (
      typeof s === "string" && s.length <= 44 && bs58.decode(s).length === 32
    );
  } catch {
    return false;
  }
}
export function normalizeRepo(value) {
  if (typeof value !== "string")
    throw Error("Use a public GitHub owner/repository.");
  let raw = value.trim();
  if (raw.startsWith("https://github.com/")) {
    const u = new URL(raw);
    if (u.search || u.hash || u.username || u.password || u.port)
      throw Error("Use a clean GitHub repository URL.");
    raw = u.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(raw) ||
    raw.endsWith("/.") ||
    raw.endsWith("/..")
  )
    throw Error("Use a public GitHub owner/repository.");
  return raw;
}
export const shortSha = (s) => (s ? s.slice(0, 7) : "--");
export function reportMarkdown(r) {
  return [
    `# ${r.repo}`,
    r.title,
    "",
    `Observed: ${r.createdAt}`,
    `Mode: ${r.mode}`,
    `Source: ${r.url}`,
    `Head: ${r.head}`,
    r.base ? `Base: ${r.base}` : "Baseline: latest revision only.",
    "",
    r.summary,
    "",
    ...r.findings.map((f) => `- ${f.label}: ${f.count}`),
    "",
    `Coverage: ${r.coverage}`,
    `Input SHA-256: ${r.inputHash}`,
    "",
    ...r.files.map(
      (f) => `- ${f.status} ${f.path} (+${f.additions}/-${f.deletions})`,
    ),
    "",
    "Rule-based metadata report. Not a security audit or an assessment of code correctness.",
  ].join("\n");
}
