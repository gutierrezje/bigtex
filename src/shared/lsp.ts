/** JSON-RPC payload forwarded between renderer and Texlab in main. */
export type LspJsonRpcMessage = Record<string, unknown>;

export interface LspSendRequest {
  rootPath: string;
  message: LspJsonRpcMessage;
}

export interface LspServerMessageEvent {
  rootPath: string;
  message: LspJsonRpcMessage;
}

export function isLspJsonRpcMessage(value: unknown): value is LspJsonRpcMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.jsonrpc === "2.0";
}
