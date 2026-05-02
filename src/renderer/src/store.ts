import { create } from "zustand";
import type {
  AgentEvent,
  CompileDiagnostic,
  CompileResult,
  CompilerKind,
  OpenFile,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
} from "../../shared/domain";

export interface AgentTranscript {
  runId: string;
  text: string;
  patch: string | null;
  running: boolean;
}

interface AppState {
  project: ProjectSnapshot | null;
  openFile: OpenFile | null;
  compiler: CompilerKind;
  compileResult: CompileResult | null;
  pdf: PdfPayload | null;
  agentTranscript: AgentTranscript | null;
  metrics: PerformanceMark[];
  setProject(project: ProjectSnapshot | null): void;
  setOpenFile(file: OpenFile | null): void;
  updateOpenFileContent(content: string): void;
  setCompileResult(result: CompileResult | null): void;
  setPdf(pdf: PdfPayload | null): void;
  setCompiler(compiler: CompilerKind): void;
  appendAgentEvent(event: AgentEvent): void;
  clearAgent(): void;
  setMetrics(metrics: PerformanceMark[]): void;
}

function diagnosticsToText(diagnostics: CompileDiagnostic[]): string {
  if (diagnostics.length === 0) return "";
  return diagnostics
    .map((diagnostic) => {
      const location = [diagnostic.file, diagnostic.line].filter(Boolean).join(":");
      return `${diagnostic.severity.toUpperCase()} ${location}: ${diagnostic.message}`;
    })
    .join("\n");
}

export const useAppStore = create<AppState>((set) => ({
  project: null,
  openFile: null,
  compiler: "latexmk",
  compileResult: null,
  pdf: null,
  agentTranscript: null,
  metrics: [],
  setProject: (project) => set({ project }),
  setOpenFile: (openFile) => set({ openFile }),
  updateOpenFileContent: (content) =>
    set((state) => ({
      openFile: state.openFile ? { ...state.openFile, content, dirty: true } : null,
    })),
  setCompileResult: (compileResult) => set({ compileResult }),
  setPdf: (pdf) => set({ pdf }),
  setCompiler: (compiler) => set({ compiler }),
  appendAgentEvent: (event) =>
    set((state) => {
      const current = state.agentTranscript ?? {
        runId: event.runId,
        text: "",
        patch: null,
        running: false,
      };

      if (event.type === "started") {
        return {
          agentTranscript: {
            runId: event.runId,
            text: `Running ${event.command}\n\n`,
            patch: null,
            running: true,
          },
        };
      }

      if (event.type === "stdout" || event.type === "stderr") {
        return {
          agentTranscript: {
            ...current,
            text: `${current.text}${event.chunk}`,
            running: true,
          },
        };
      }

      if (event.type === "patch") {
        return {
          agentTranscript: {
            ...current,
            patch: event.patch,
            text: `${current.text}\n\nDetected patch:\n\n\`\`\`diff\n${event.patch}\n\`\`\``,
          },
        };
      }

      if (event.type === "error") {
        return {
          agentTranscript: {
            ...current,
            text: `${current.text}\n\nAgent error: ${event.message}`,
            running: false,
          },
        };
      }

      if (event.type === "finished") {
        return {
          agentTranscript: {
            ...current,
            text: `${current.text}\n\nFinished in ${event.durationMs}ms with exit code ${
              event.exitCode ?? "unknown"
            }.\n${diagnosticsToText(state.compileResult?.diagnostics ?? [])}`,
            running: false,
          },
        };
      }

      return { agentTranscript: current };
    }),
  clearAgent: () => set({ agentTranscript: null }),
  setMetrics: (metrics) => set({ metrics }),
}));
