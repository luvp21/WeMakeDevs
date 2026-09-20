import type { IngestResult } from "./index.js";

// The text of a file from the repo ingest (a sample source file or a package file), by path.
// Used by the video renderer and the browser preview so both show the same code.
export function findIngestedFile(ingest: IngestResult | null, filePath: string): string | null {
  if (!ingest) return null;
  const file = [...ingest.sample_files, ...ingest.package_files].find((f) => f.path === filePath);
  return file?.content ?? null;
}
