import type { IngestedFile, IngestResult } from "@vaani/shared";
import { getJson, putJson } from "./s3.js";

// Repo ingest pulls README + package files + a capped sample of source files
// via the GitHub tree API and raw.githubusercontent.com, not `git clone`. Lambda has no
// git binary by default and a full clone is more than a capped sample needs.

const MAX_SAMPLE_FILES = 12;
const MAX_FILE_BYTES = 20_000;

const PACKAGE_FILE_NAMES = new Set([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "Gemfile",
  "mix.exs",
]);

const EXCLUDED_DIR_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "vendor",
  ".next",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
]);

const EXCLUDED_FILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "Cargo.lock",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb",
  ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".kt", ".swift", ".scala",
]);

interface GithubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export class IngestError extends Error {}

export function parseGithubUrl(repoUrl: string): { owner: string; repo: string } {
  const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  if (!match) {
    throw new IngestError(`Not a recognizable GitHub URL: ${repoUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vaani-ai-ingest",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// GitHub allows 60 API requests an hour per IP without a token (5,000 with one),
// and on Lambda the IP is shared. So an ingest spends exactly ONE API request:
// the file tree. "HEAD" stands for the default branch in both the tree API and
// raw.githubusercontent.com, so there is no separate repo lookup, and file
// contents come from raw.githubusercontent.com, which the API limit doesn't cover.
const BRANCH = "HEAD";

// Turns a failed GitHub response into something a person can act on. A used-up
// rate limit says when it resets, instead of a bare "(403)".
export function githubFailureMessage(
  status: number,
  header: (name: string) => string | null,
  target: string,
  now: number = Date.now(),
): string {
  if (status === 404) {
    return `Couldn't find ${target} on GitHub. Check the URL, and that the repository is public.`;
  }
  const rateLimited = status === 429 || (status === 403 && header("x-ratelimit-remaining") === "0");
  if (rateLimited) {
    const reset = Number(header("x-ratelimit-reset"));
    const minutes = Number.isFinite(reset) && reset > 0 ? Math.max(1, Math.ceil((reset * 1000 - now) / 60000)) : null;
    const when = minutes ? `Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` : "Try again in a little while.";
    return `GitHub's hourly request limit for this server has been reached. ${when} Repos you've already used are remembered for a few minutes.`;
  }
  return `GitHub returned an error (${status}) for ${target}.`;
}

async function getTree(owner: string, repo: string): Promise<GithubTreeEntry[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${BRANCH}?recursive=1`,
    { headers: githubHeaders() },
  );
  if (!res.ok) {
    throw new IngestError(githubFailureMessage(res.status, (name) => res.headers.get(name), `${owner}/${repo}`));
  }
  const data = (await res.json()) as { tree: GithubTreeEntry[]; truncated: boolean };
  return data.tree;
}

function isExcluded(path: string): boolean {
  const segments = path.split("/");
  const fileName = segments[segments.length - 1];
  if (EXCLUDED_FILE_NAMES.has(fileName)) return true;
  return segments.some((seg) => EXCLUDED_DIR_SEGMENTS.has(seg));
}

async function fetchRawFile(owner: string, repo: string, path: string): Promise<string | null> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${BRANCH}/${path}`,
    { headers: githubHeaders() },
  );
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FILE_BYTES) {
    return Buffer.from(buf.slice(0, MAX_FILE_BYTES)).toString("utf-8") + "\n...[truncated]";
  }
  return Buffer.from(buf).toString("utf-8");
}

// How long a fetched repo is remembered. Long enough that retrying, or a few
// people trying the same example repo, costs no GitHub requests; short enough
// that new commits show up soon.
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CachedIngest {
  fetched_at: number;
  result: IngestResult;
}

function cacheKey(owner: string, repo: string): string {
  return `ingest-cache/${owner.toLowerCase()}/${repo.toLowerCase()}.json`;
}

export async function ingestRepo(repoUrl: string): Promise<IngestResult> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  // A cache problem must never break ingest, so both directions swallow errors.
  const cached = await getJson<CachedIngest>(cacheKey(owner, repo)).catch(() => null);
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return { ...cached.result, repo_url: repoUrl };
  }

  const result = await fetchRepo(repoUrl, owner, repo);
  await putJson(cacheKey(owner, repo), { fetched_at: Date.now(), result } satisfies CachedIngest).catch(() => undefined);
  return result;
}

async function fetchRepo(repoUrl: string, owner: string, repo: string): Promise<IngestResult> {
  const tree = await getTree(owner, repo);

  const blobs = tree.filter((entry) => entry.type === "blob" && !isExcluded(entry.path));

  const readmeEntry = blobs.find((entry) =>
    /^readme(\.md|\.rst|\.txt)?$/i.test(entry.path.split("/").pop() ?? ""),
  );
  const readme = readmeEntry ? await fetchRawFile(owner, repo, readmeEntry.path) : null;

  const packageEntries = blobs.filter((entry) =>
    PACKAGE_FILE_NAMES.has(entry.path.split("/").pop() ?? ""),
  );
  const packageFiles: IngestedFile[] = [];
  for (const entry of packageEntries) {
    const content = await fetchRawFile(owner, repo, entry.path);
    if (content !== null) packageFiles.push({ path: entry.path, content });
  }

  const sampleCandidates = blobs
    .filter((entry) => {
      const dotIndex = entry.path.lastIndexOf(".");
      const ext = dotIndex >= 0 ? entry.path.slice(dotIndex) : "";
      return SOURCE_EXTENSIONS.has(ext) && entry !== readmeEntry;
    })
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))
    .slice(0, MAX_SAMPLE_FILES);

  const sampleFiles: IngestedFile[] = [];
  for (const entry of sampleCandidates) {
    const content = await fetchRawFile(owner, repo, entry.path);
    if (content !== null) sampleFiles.push({ path: entry.path, content });
  }

  return {
    repo_url: repoUrl,
    readme,
    package_files: packageFiles,
    sample_files: sampleFiles,
  };
}
