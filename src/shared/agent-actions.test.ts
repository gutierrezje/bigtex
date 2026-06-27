import { describe, expect, it } from "vitest";
import {
  extractBigTexAgentAction,
  promptRequestsCompile,
  stripBigTexAgentActions,
} from "./agent-actions";

describe("agent actions", () => {
  it("extracts a single compile action from a fenced block", () => {
    expect(
      extractBigTexAgentAction(
        'Done editing.\n```bigtex-action\n{"kind":"compile","reason":"verify"}\n```',
      ),
    ).toEqual({ kind: "compile", reason: "verify" });
  });

  it("rejects malformed, unknown, or multiple actions", () => {
    expect(extractBigTexAgentAction("```bigtex-action\n{}\n```")).toBeNull();
    expect(extractBigTexAgentAction('```bigtex-action\n{"kind":"open"}\n```')).toBeNull();
    expect(extractBigTexAgentAction("```bigtex-action\nnot json\n```")).toBeNull();
    expect(
      extractBigTexAgentAction(
        '```bigtex-action\n{"kind":"compile"}\n```\n```bigtex-action\n{"kind":"compile"}\n```',
      ),
    ).toBeNull();
  });

  it("strips action blocks from visible assistant markdown", () => {
    expect(
      stripBigTexAgentActions('Ready.\n```bigtex-action\n{"kind":"compile"}\n```\nThanks.'),
    ).toBe("Ready.\n\nThanks.");
  });

  it("detects user prompts that ask for compile verification", () => {
    expect(promptRequestsCompile("fix this and compile")).toBe(true);
    expect(promptRequestsCompile("verify the PDF after editing")).toBe(true);
    expect(promptRequestsCompile("fix until green")).toBe(true);
    expect(promptRequestsCompile("rewrite the abstract")).toBe(false);
  });
});
