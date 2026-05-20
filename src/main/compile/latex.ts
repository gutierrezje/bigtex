import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { CompileRequest, CompileResult } from "../../shared/domain";
import { assertInsideRoot, outputPdfPath } from "../files/project";
import { measure } from "../performance/marks";
import { parseDiagnostics } from "./diagnostics";

function compilerCommand(request: CompileRequest): { command: string; args: string[] } {
  const mainFile = assertInsideRoot(request.rootPath, request.mainFile);

  return {
    command: "latexmk",
    args: ["-pdf", "-interaction=nonstopmode", "-file-line-error", "-synctex=1", mainFile],
  };
}

function compileWithProcess(
  request: CompileRequest,
  command: string,
  args: string[],
): Promise<CompileResult> {
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: request.rootPath,
      shell: false,
      env: {
        ...process.env,
        max_print_line: "1000",
      },
    });

    let output = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      const durationMs = Math.round(performance.now() - startedAt);
      resolve({
        success: false,
        command: `${command} ${args.join(" ")}`,
        durationMs,
        output: `${output}\n${error.message}`,
        pdfPath: null,
        diagnostics: [
          {
            file: null,
            line: null,
            severity: "error",
            message: `${command} could not be started. Install latexmk or add it to your PATH.`,
          },
        ],
      });
    });

    child.on("close", (exitCode) => {
      const durationMs = Math.round(performance.now() - startedAt);
      const pdfPath = outputPdfPath(request.rootPath, request.mainFile);
      const diagnostics = parseDiagnostics(output);

      resolve({
        success: exitCode === 0 && existsSync(pdfPath),
        command: `${command} ${args.join(" ")}`,
        durationMs,
        output,
        pdfPath: existsSync(pdfPath) ? pdfPath : null,
        diagnostics:
          diagnostics.length > 0
            ? diagnostics
            : exitCode === 0
              ? []
              : [
                  {
                    file: basename(request.mainFile),
                    line: null,
                    severity: "error",
                    message: `Compiler exited with code ${exitCode ?? "unknown"}`,
                  },
                ],
      });
    });
  });
}

export async function compileLatex(request: CompileRequest): Promise<CompileResult> {
  assertInsideRoot(request.rootPath, request.mainFile);
  const { command, args } = compilerCommand(request);
  return measure("compile:latexmk", () => compileWithProcess(request, command, args));
}
