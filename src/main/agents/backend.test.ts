import { describe, expect, it } from "vitest";
import { getAgentBackend, resolveAgentBackendId } from "./backend";

describe("agent backend selector", () => {
  it("defaults to serve", () => {
    expect(resolveAgentBackendId(undefined)).toBe("serve");
    expect(getAgentBackend(undefined).id).toBe("serve");
  });

  it("selects ACP only when explicitly requested", () => {
    expect(resolveAgentBackendId("acp")).toBe("acp");
    expect(getAgentBackend("acp").id).toBe("acp");
  });

  it("selects serve when explicitly requested", () => {
    expect(resolveAgentBackendId("serve")).toBe("serve");
    expect(getAgentBackend("serve").id).toBe("serve");
  });

  it("falls back to serve for unknown values", () => {
    expect(resolveAgentBackendId("unknown")).toBe("serve");
    expect(getAgentBackend("unknown").id).toBe("serve");
  });
});
