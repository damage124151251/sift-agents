import { readFile } from "node:fs/promises";
const production = process.argv.includes("--production"),
  base = production
    ? "https://sift-agents.vercel.app"
    : "http://127.0.0.1:5249";
const secrets = JSON.parse(
  await readFile(
    new URL(
      production ? "../.local/operator.json" : "../.local/dev-access.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function call(path, body, cron = false) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${cron ? secrets.cron : secrets.operator}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(58000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || `Request ${r.status}`);
  return d;
}
const walletArg = process.argv.indexOf("--wallet");
if (walletArg >= 0) {
  const wallet = process.argv[walletArg + 1];
  if (!wallet) throw Error("Provide a public wallet address.");
  console.log(await call("/api/operator", { action: "set-wallet", wallet }));
  console.log(await call("/api/operator", { action: "watch" }));
}
console.log(await call("/api/operator", { action: "run" }));
const s = await call("/api/status");
console.log(
  JSON.stringify(
    {
      sources: s.sources.map((x) => ({
        repo: x.repo,
        head: x.head,
        status: x.status,
        error: x.error,
      })),
      runs: s.runs.length,
      reports: s.reports.map((r) => ({
        repo: r.repo,
        head: r.head,
        files: r.files.length,
        inputHash: r.inputHash,
      })),
      identity: s.identity,
    },
    null,
    2,
  ),
);
