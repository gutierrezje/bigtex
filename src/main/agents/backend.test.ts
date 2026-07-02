import { describe, expect, it } from "vitest";
import { getAgentBackend } from "./backend";

describe("agent backend", () => {
  it("uses the OpenCode serve backend", () => {
    expect(getAgentBackend().id).toBe("serve");
  });
});
