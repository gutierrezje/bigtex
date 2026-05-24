import { describe, expect, it } from "vitest";
import { isLspJsonRpcMessage } from "./lsp";

describe("isLspJsonRpcMessage", () => {
  it("accepts valid JSON-RPC envelopes", () => {
    expect(isLspJsonRpcMessage({ jsonrpc: "2.0", method: "initialize", params: {} })).toBe(true);
    expect(isLspJsonRpcMessage({ jsonrpc: "2.0", id: 1, result: {} })).toBe(true);
  });

  it("rejects invalid payloads", () => {
    expect(isLspJsonRpcMessage(null)).toBe(false);
    expect(isLspJsonRpcMessage({ jsonrpc: "1.0" })).toBe(false);
  });
});
