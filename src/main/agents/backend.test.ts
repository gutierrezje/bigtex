import { describe, expect, it } from "vitest";
import { getAgentBackend, resolveAgentBackendId } from "./backend";

describe("agent backend selector", () => {
  it("defaults to ACP", () => {
    expect(resolveAgentBackendId(undefined)).toBe("acp");
    expect(getAgentBackend(undefined).id).toBe("acp");
  });

  it("selects serve only when explicitly requested", () => {
    expect(resolveAgentBackendId("serve")).toBe("serve");
    expect(getAgentBackend("serve").id).toBe("serve");
  });

  it("falls back to ACP for unknown values", () => {
    expect(resolveAgentBackendId("unknown")).toBe("acp");
    expect(getAgentBackend("unknown").id).toBe("acp");
  });
});
