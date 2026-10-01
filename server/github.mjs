import { normalizeRepo } from "../src/domain.mjs";
const SHA = /^[0-9a-f]{40}$/;
export const validSha = (s) => typeof s === "string" && SHA.test(s);
export function createGitHub({ fetcher = fetch, now = Date.now } = {}) {
  const deadline = now() + 45000;
  return async (path, { etag } = {}) => {
    if (
      !path.startsWith("/repos/") ||
      (path.includes("..") && !path.includes("/compare/"))
    )
      throw Error("Invalid GitHub route.");
    const remaining = deadline - now();
    if (remaining <= 0) throw Error("Source request deadline exceeded.");
    const response = await fetcher(`https://api.github.com${path}`, {
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "SIFT-observation-agents",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      signal: AbortSignal.timeout(Math.min(9000, remaining)),
    });
    if (response.status === 304) return { unchanged: true, etag };
    if (response.status === 403 || response.status === 429)
      throw Error("GitHub rate limit reached. Previous checkpoint retained.");
    if (response.status === 404)
      throw Error("Public repository or revision unavailable.");
    if (!response.ok) throw Error("GitHub source unavailable.");
    const length = Number(response.headers.get("content-length"));
    if (length > 6e6) {
      await response.body?.cancel();
      throw Error("Source response exceeds the coverage limit.");
    }
    const reader = response.body.getReader();
    let bytes = 0;
    const parts = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 6e6) {
        await reader.cancel();
        throw Error("Source response exceeds the coverage limit.");
      }
      parts.push(value);
    }
    const data = JSON.parse(Buffer.concat(parts).toString("utf8"));
    return {
      data,
      etag: response.headers.get("etag"),
      hasNext: /(?:^|,)\s*<[^>]+>;\s*rel="next"/.test(
        response.headers.get("link") || "",
      ),
    };
  };
}
export async function verifyRepo(value, github) {
  const repo = normalizeRepo(value),
    r = await github(`/repos/${repo}`);
  if (
    r.data.private !== false ||
    r.data.full_name?.toLowerCase() !== repo.toLowerCase()
  )
    throw Error(
      "Only public repositories with a matching identity are supported.",
    );
  return r.data.full_name;
}
export async function collect(source, github) {
  const repo = normalizeRepo(source.repo),
    headResponse = await github(`/repos/${repo}/commits?per_page=1`, {
      etag: source.etag,
    });
  if (headResponse.unchanged) {
    if (!validSha(source.head))
      throw Error("A checkpoint is required for an unchanged response.");
    return { unchanged: true, head: source.head, etag: source.etag };
  }
  const head = headResponse.data?.[0];
  if (!validSha(head?.sha) || typeof head.commit?.message !== "string")
    throw Error("Invalid source revision.");
  if (head.sha === source.head)
    return { unchanged: true, head: head.sha, etag: headResponse.etag };
  let detail,
    mode = source.head ? "comparison" : "baseline",
    url = `https://github.com/${repo}/commit/${head.sha}`,
    coverage =
      "Latest commit only. Up to 100 file records; not the full repository history.";
  if (source.head) {
    if (!validSha(source.head)) throw Error("Invalid stored checkpoint.");
    detail = await github(
      `/repos/${repo}/compare/${source.head}...${head.sha}?per_page=100`,
    );
    if (
      detail.data.status !== "ahead" ||
      detail.data.base_commit?.sha !== source.head ||
      detail.data.merge_base_commit?.sha !== source.head
    )
      throw Error(
        "Repository history diverged. Checkpoint retained for review.",
      );
    url = `https://github.com/${repo}/compare/${source.head}...${head.sha}`;
    coverage =
      "Files listed by GitHub between checkpoints, capped at 300. Renames use the returned filename.";
  } else {
    detail = await github(`/repos/${repo}/commits/${head.sha}?per_page=100`);
    if (detail.data.sha !== head.sha) throw Error("Source revision mismatch.");
  }
  if (!Array.isArray(detail.data.files))
    throw Error("Changed-file evidence unavailable.");
  const limit = source.head ? 300 : 100,
    truncated = detail.hasNext || detail.data.files.length >= limit;
  const files = detail.data.files.slice(0, limit).map((f) => {
    if (
      typeof f.filename !== "string" ||
      f.filename.length > 1024 ||
      ![
        "added",
        "removed",
        "modified",
        "renamed",
        "copied",
        "changed",
        "unchanged",
      ].includes(f.status) ||
      !Number.isSafeInteger(f.additions) ||
      f.additions < 0 ||
      !Number.isSafeInteger(f.deletions) ||
      f.deletions < 0
    )
      throw Error("Invalid file evidence.");
    return {
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    };
  });
  return {
    repo,
    head: head.sha,
    base: source.head,
    mode,
    title: head.commit.message.split("\n")[0].slice(0, 240),
    commitAt: head.commit.committer?.date || null,
    url,
    etag: headResponse.etag,
    files,
    truncated,
    coverage: truncated
      ? `${coverage} Coverage may be incomplete; no all-clear assessment is made.`
      : coverage,
  };
}
