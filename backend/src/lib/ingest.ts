import type { IngestedFile, IngestResult } from "@vaani/shared";

// Repo ingest pulls README + package files + a capped sample of source files
// via the GitHub API (contents/tree endpoints), not `git clone`. Lambda has no
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

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) {
    throw new IngestError(`GitHub repo lookup failed (${res.status}): ${owner}/${repo}`);
  }
  const data = (await res.json()) as { default_branch: string };
  return data.default_branch;
}

async function getTree(owner: string, repo: string, branch: string): Promise<GithubTreeEntry[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: githubHeaders() },
  );
  if (!res.ok) {
    throw new IngestError(`GitHub tree fetch failed (${res.status}) for ${owner}/${repo}@${branch}`);
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

async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    { headers: githubHeaders() },
  );
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FILE_BYTES) {
    return Buffer.from(buf.slice(0, MAX_FILE_BYTES)).toString("utf-8") + "\n...[truncated]";
  }
  return Buffer.from(buf).toString("utf-8");
}

export async function ingestRepo(repoUrl: string): Promise<IngestResult> {
  const { owner, repo } = parseGithubUrl(repoUrl);
  const branch = await getDefaultBranch(owner, repo);
  const tree = await getTree(owner, repo, branch);

  const blobs = tree.filter((entry) => entry.type === "blob" && !isExcluded(entry.path));

  const readmeEntry = blobs.find((entry) =>
    /^readme(\.md|\.rst|\.txt)?$/i.test(entry.path.split("/").pop() ?? ""),
  );
  const readme = readmeEntry ? await fetchRawFile(owner, repo, branch, readmeEntry.path) : null;

  const packageEntries = blobs.filter((entry) =>
    PACKAGE_FILE_NAMES.has(entry.path.split("/").pop() ?? ""),
  );
  const packageFiles: IngestedFile[] = [];
  for (const entry of packageEntries) {
    const content = await fetchRawFile(owner, repo, branch, entry.path);
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
    const content = await fetchRawFile(owner, repo, branch, entry.path);
    if (content !== null) sampleFiles.push({ path: entry.path, content });
  }

  return {
    repo_url: repoUrl,
    readme,
    package_files: packageFiles,
    sample_files: sampleFiles,
  };
}
