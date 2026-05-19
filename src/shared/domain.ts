export type FileKind = "tex" | "bib" | "style" | "config" | "folder" | "other";

export interface ProjectFile {
  name: string;
  path: string;
  absolutePath: string;
  kind: FileKind;
  children?: ProjectFile[];
}

export interface ProjectSnapshot {
  rootPath: string;
  name: string;
  files: ProjectFile[];
  mainFile: string | null;
}

export interface OpenFile {
  path: string;
  absolutePath: string;
  content: string;
  dirty: boolean;
}

export type CompilerKind = "latexmk" | "tectonic";

export interface CompileDiagnostic {
  file: string | null;
  line: number | null;
  severity: "error" | "warning";
  message: string;
}

export interface CompileRequest {
  rootPath: string;
  mainFile: string;
  compiler: CompilerKind;
}

export interface CompileResult {
  success: boolean;
  compiler: CompilerKind;
  command: string;
  durationMs: number;
  output: string;
  pdfPath: string | null;
  diagnostics: CompileDiagnostic[];
}

export interface PdfPayload {
  path: string;
  data: Uint8Array;
  loadedAt: number;
}

export interface AgentAvailability {
  available: boolean;
  command: string;
  version: string | null;
  message: string;
}

export interface AgentRunInput {
  rootPath: string;
  prompt: string;
  selectedFiles: string[];
  diagnostics: CompileDiagnostic[];
}

export type AgentEvent =
  | {
      type: "started";
      runId: string;
      command: string;
      at: number;
    }
  | {
      type: "stdout" | "stderr";
      runId: string;
      chunk: string;
      at: number;
    }
  | {
      type: "patch";
      runId: string;
      patch: string;
      at: number;
    }
  | {
      type: "filesChanged";
      runId: string;
      paths: string[];
      at: number;
    }
  | {
      type: "finished";
      runId: string;
      exitCode: number | null;
      durationMs: number;
      at: number;
    }
  | {
      type: "error";
      runId: string;
      message: string;
      at: number;
    };

export interface AgentRunSummary {
  runId: string;
}

export interface PatchApplyRequest {
  rootPath: string;
  patch: string;
}

export interface PatchApplyResult {
  applied: boolean;
  changedFiles: string[];
  message: string;
}

export interface PerformanceMark {
  name: string;
  durationMs: number;
  at: number;
}
