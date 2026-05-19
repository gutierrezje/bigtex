import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { FileKind, OpenFile, ProjectFile, ProjectSnapshot } from "../../shared/domain";

const MAX_TREE_DEPTH = 8;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "out",
  ".latex-cache",
]);
const IGNORED_EXTENSIONS = new Set([
  ".aux",
  ".bbl",
  ".blg",
  ".fls",
  ".fdb_latexmk",
  ".log",
  ".synctex.gz",
]);

export function assertInsideRoot(rootPath: string, candidatePath: string): string {
  const root = resolve(rootPath);
  const candidate = isAbsolute(candidatePath)
    ? resolve(candidatePath)
    : resolve(root, candidatePath);
  const rel = relative(root, candidate);

  if (rel.startsWith("..") || rel === ".." || isAbsolute(rel)) {
    throw new Error(`Path is outside the project: ${candidatePath}`);
  }

  return candidate;
}

function toProjectRelative(rootPath: string, absolutePath: string): string {
  return relative(rootPath, absolutePath).split(sep).join("/");
}

function fileKind(name: string, directory: boolean): FileKind {
  if (directory) return "folder";

  switch (extname(name).toLowerCase()) {
    case ".tex":
      return "tex";
    case ".bib":
      return "bib";
    case ".sty":
    case ".cls":
      return "style";
    case ".json":
    case ".yml":
    case ".yaml":
    case ".toml":
      return "config";
    default:
      return "other";
  }
}

async function listDirectory(
  rootPath: string,
  directoryPath: string,
  depth: number,
): Promise<ProjectFile[]> {
  if (depth > MAX_TREE_DEPTH) return [];

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => {
        if (entry.isDirectory()) return !IGNORED_DIRECTORIES.has(entry.name);
        return !IGNORED_EXTENSIONS.has(extname(entry.name).toLowerCase());
      })
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
        return left.name.localeCompare(right.name);
      })
      .map(async (entry): Promise<ProjectFile> => {
        const absolutePath = join(directoryPath, entry.name);
        const relativePath = toProjectRelative(rootPath, absolutePath);
        const directory = entry.isDirectory();

        return {
          name: entry.name,
          path: relativePath,
          absolutePath,
          kind: fileKind(entry.name, directory),
          children: directory ? await listDirectory(rootPath, absolutePath, depth + 1) : undefined,
        };
      }),
  );

  return files;
}

function flattenFiles(files: ProjectFile[]): ProjectFile[] {
  return files.flatMap((file) => [file, ...(file.children ? flattenFiles(file.children) : [])]);
}

function inferMainFile(files: ProjectFile[]): string | null {
  const texFiles = flattenFiles(files).filter((file) => file.kind === "tex");
  const mainByName = texFiles.find((file) => basename(file.name, ".tex").toLowerCase() === "main");
  return mainByName?.path ?? texFiles[0]?.path ?? null;
}

export async function loadProject(rootPath: string): Promise<ProjectSnapshot> {
  const root = resolve(rootPath);
  const info = await stat(root);
  if (!info.isDirectory()) {
    throw new Error("Project root must be a directory");
  }

  const files = await listDirectory(root, root, 0);

  return {
    rootPath: root,
    name: basename(root) || root,
    files,
    mainFile: inferMainFile(files),
  };
}

export async function readProjectFile(rootPath: string, path: string): Promise<OpenFile> {
  const absolutePath = assertInsideRoot(rootPath, path);
  const content = await readFile(absolutePath, "utf8");

  return {
    path: toProjectRelative(resolve(rootPath), absolutePath),
    absolutePath,
    content,
    dirty: false,
    loadedAt: Date.now(),
  };
}

export async function writeProjectFile(
  rootPath: string,
  path: string,
  content: string,
): Promise<OpenFile> {
  const absolutePath = assertInsideRoot(rootPath, path);
  await writeFile(absolutePath, content, "utf8");
  return readProjectFile(rootPath, relative(resolve(rootPath), absolutePath));
}

export function defaultSampleProjectPath(appRoot: string): string {
  return resolve(appRoot, "samples/minimal");
}

export function defaultMainFile(rootPath: string, preferred: string | null): string {
  return preferred ?? relative(rootPath, join(rootPath, "main.tex"));
}

export function outputPdfPath(rootPath: string, mainFile: string): string {
  const source = assertInsideRoot(rootPath, mainFile);
  return join(dirname(source), `${basename(source, extname(source))}.pdf`);
}
