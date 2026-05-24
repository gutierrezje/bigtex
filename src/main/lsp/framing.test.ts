import { describe, expect, it } from "vitest";
import { formatLspMessage, LspMessageReader } from "./framing";

describe("formatLspMessage", () => {
  it("wraps JSON with Content-Length header", () => {
    const framed = formatLspMessage({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(framed).toBe('Content-Length: 46\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize"}');
  });
});

describe("LspMessageReader", () => {
  it("parses a single framed message", () => {
    const reader = new LspMessageReader();
    const payload = formatLspMessage({ jsonrpc: "2.0", id: 1, result: {} });
    expect(reader.push(payload)).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}']);
  });

  it("reassembles messages split across chunks", () => {
    const reader = new LspMessageReader();
    const payload = formatLspMessage({ jsonrpc: "2.0", method: "initialized" });
    const split = Math.floor(payload.length / 2);
    expect(reader.push(payload.slice(0, split))).toEqual([]);
    expect(reader.push(payload.slice(split))).toEqual(['{"jsonrpc":"2.0","method":"initialized"}']);
  });
});
