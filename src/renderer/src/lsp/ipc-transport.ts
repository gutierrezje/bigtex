import { createConnection, type IConnectionProvider } from "monaco-languageclient/lib/connection";
import {
  AbstractMessageReader,
  AbstractMessageWriter,
  createMessageConnection,
  type DataCallback,
  type Disposable,
  type Message,
} from "vscode-jsonrpc";
import type { LspJsonRpcMessage } from "../../../shared/lsp";
import type { createLspIpcBridge } from "./ipc-bridge";

export type LspIpcBridge = ReturnType<typeof createLspIpcBridge>;

class IpcMessageReader extends AbstractMessageReader {
  constructor(private readonly bridge: LspIpcBridge) {
    super();
  }

  listen(callback: DataCallback): Disposable {
    const off = this.bridge.onMessage((message) => {
      callback(message as unknown as Message);
    });
    return { dispose: off };
  }
}

class IpcMessageWriter extends AbstractMessageWriter {
  constructor(private readonly bridge: LspIpcBridge) {
    super();
  }

  write(msg: Message): Promise<void> {
    this.bridge.send(msg as unknown as LspJsonRpcMessage);
    return Promise.resolve();
  }

  end(): void {}
}

export function createIpcConnectionProvider(bridge: LspIpcBridge): IConnectionProvider {
  return {
    get(errorHandler, closeHandler) {
      const reader = new IpcMessageReader(bridge);
      const writer = new IpcMessageWriter(bridge);
      const messageConnection = createMessageConnection(reader, writer);
      messageConnection.onError(([error]) => {
        errorHandler(error, undefined, undefined);
      });
      messageConnection.onClose(() => {
        closeHandler();
      });
      return Promise.resolve(createConnection(messageConnection, errorHandler, closeHandler));
    },
  };
}
