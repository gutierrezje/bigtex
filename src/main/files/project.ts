import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { FileKind, OpenFile, ProjectFile, ProjectSnapshot } from "../../shared/domain";
import { latexOutputPdfPath, shouldHideProjectTreeEntry } from "../../shared/latexArtifacts";
import {
  CREATABLE_FILE_EXTENSIONS,
  isCreatableFileName,
  resolveFolderName,
} from "../../shared/projectFiles";

const MAX_TREE_DEPTH = 8;

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
    case ".pdf":
      return "pdf";
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
      .filter((entry) => !shouldHideProjectTreeEntry(entry.name, entry.isDirectory()))
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

/** Resolve bundled sample when app runs from repo root, `out/`, or asar. */
export async function resolveSampleProjectPath(
  appRoot: string,
  cwd = process.cwd(),
): Promise<string> {
  const candidates = [
    defaultSampleProjectPath(appRoot),
    defaultSampleProjectPath(resolve(appRoot, "../..")),
    defaultSampleProjectPath(cwd),
  ];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return candidates[0];
}

export function defaultMainFile(rootPath: string, preferred: string | null): string {
  return preferred ?? relative(rootPath, join(rootPath, "main.tex"));
}

export function outputPdfPath(rootPath: string, mainFile: string): string {
  assertInsideRoot(rootPath, mainFile);
  return latexOutputPdfPath(resolve(rootPath), mainFile);
}

function validateEntryName(name: string): void {
  if (!name.trim()) throw new Error("Name is required");
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
    throw new Error("Invalid name");
  }
}

function assertCreatableFileName(name: string): void {
  validateEntryName(name);
  if (!isCreatableFileName(name)) {
    throw new Error(
      `Only LaTeX-related files are supported (${CREATABLE_FILE_EXTENSIONS.join(", ")})`,
    );
  }
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueFileName(directoryAbs: string, baseName: string): Promise<string> {
  const ext = extname(baseName);
  const stem = basename(baseName, ext);
  let candidate = baseName;
  let index = 1;
  while (await pathExists(join(directoryAbs, candidate))) {
    candidate = `${stem}-${index}${ext}`;
    index += 1;
  }
  return candidate;
}

async function uniqueFolderName(directoryAbs: string, baseName: string): Promise<string> {
  let candidate = baseName;
  let index = 1;
  while (await pathExists(join(directoryAbs, candidate))) {
    candidate = `${baseName}-${index}`;
    index += 1;
  }
  return candidate;
}

function resolveParentDirectory(rootPath: string, parentPath: string): string {
  const parent = parentPath.trim();
  if (!parent) return resolve(rootPath);
  return assertInsideRoot(rootPath, parent);
}

export async function createProjectFile(
  rootPath: string,
  parentPath: string,
  name: string,
): Promise<{ snapshot: ProjectSnapshot; createdPath: string }> {
  const root = resolve(rootPath);
  const parentAbs = resolveParentDirectory(root, parentPath);
  const parentInfo = await stat(parentAbs);
  if (!parentInfo.isDirectory()) {
    throw new Error("Parent must be a folder");
  }

  const fileName = await uniqueFileName(parentAbs, name);
  assertCreatableFileName(fileName);

  const absolutePath = join(parentAbs, fileName);
  await writeFile(absolutePath, "", "utf8");
  const createdPath = toProjectRelative(root, absolutePath);
  return { snapshot: await loadProject(rootPath), createdPath };
}

export async function createProjectFolder(
  rootPath: string,
  parentPath: string,
  name: string,
): Promise<{ snapshot: ProjectSnapshot; createdPath: string }> {
  const resolved = resolveFolderName(name);
  if (!resolved) {
    throw new Error("Invalid folder name");
  }

  const root = resolve(rootPath);
  const parentAbs = resolveParentDirectory(root, parentPath);
  const parentInfo = await stat(parentAbs);
  if (!parentInfo.isDirectory()) {
    throw new Error("Parent must be a folder");
  }

  const folderName = await uniqueFolderName(parentAbs, resolved);
  const absolutePath = join(parentAbs, folderName);
  await mkdir(absolutePath);
  const createdPath = toProjectRelative(root, absolutePath);
  return { snapshot: await loadProject(rootPath), createdPath };
}

export async function renameProjectPath(
  rootPath: string,
  path: string,
  newName: string,
): Promise<{ snapshot: ProjectSnapshot; newPath: string }> {
  validateEntryName(newName);
  const fromAbs = assertInsideRoot(rootPath, path);
  const toAbs = join(dirname(fromAbs), newName);
  if (toAbs === fromAbs) {
    const snapshot = await loadProject(rootPath);
    return { snapshot, newPath: path };
  }

  if (await pathExists(toAbs)) {
    throw new Error("A file or folder with that name already exists");
  }

  await rename(fromAbs, toAbs);
  const root = resolve(rootPath);
  const newPath = toProjectRelative(root, toAbs);
  return { snapshot: await loadProject(rootPath), newPath };
}

export async function deleteProjectPath(rootPath: string, path: string): Promise<ProjectSnapshot> {
  const root = resolve(rootPath);
  const targetAbs = assertInsideRoot(rootPath, path);
  if (targetAbs === root) {
    throw new Error("Cannot delete the project root");
  }

  await rm(targetAbs, { recursive: true, force: true });
  return loadProject(rootPath);
}
