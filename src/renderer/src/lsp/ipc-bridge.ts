import type { LspJsonRpcMessage, LspServerMessageEvent } from "../../../shared/lsp";

/** Bidirectional LSP bridge over Electron IPC (step 3 wires this to monaco-languageclient). */
export function createLspIpcBridge(rootPath: string) {
  const listeners = new Set<(message: LspJsonRpcMessage) => void>();

  const unsubscribe = window.bigTex.lsp.onMessage((event: LspServerMessageEvent) => {
    if (event.rootPath !== rootPath) return;
    for (const listener of listeners) {
      listener(event.message);
    }
  });

  return {
    send(message: LspJsonRpcMessage): void {
      void window.bigTex.lsp.send({ rootPath, message });
    },
    onMessage(listener: (message: LspJsonRpcMessage) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      listeners.clear();
      unsubscribe();
    },
  };
}
