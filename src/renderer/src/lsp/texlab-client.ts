import * as monaco from "monaco-editor";
import {
  CloseAction,
  ErrorAction,
  MonacoLanguageClient,
  MonacoServices,
} from "monaco-languageclient";
import { disposeAllLspEditorDocuments } from "./editor-documents";
import { pathToFileUri } from "./file-uri";
import { createLspIpcBridge } from "./ipc-bridge";
import { createIpcConnectionProvider } from "./ipc-transport";
import { LSP_DIAGNOSTIC_OWNER } from "./static-diagnostics";

let client: MonacoLanguageClient | null = null;
let bridge: ReturnType<typeof createLspIpcBridge> | null = null;

function installMonacoServices(rootPath: string): void {
  MonacoServices.install(monaco, { rootUri: pathToFileUri(rootPath) });
}

export async function startTexlabLanguageClient(options: {
  rootPath: string;
  mainFile: string | null;
}): Promise<void> {
  await stopTexlabLanguageClient();

  installMonacoServices(options.rootPath);
  bridge = createLspIpcBridge(options.rootPath);

  const languageClient = new MonacoLanguageClient({
    name: "Texlab",
    clientOptions: {
      documentSelector: [
        { scheme: "file", language: "latex" },
        { scheme: "file", language: "bibtex" },
      ],
      diagnosticCollectionName: LSP_DIAGNOSTIC_OWNER,
      initializationOptions: options.mainFile ? { rootFile: options.mainFile } : {},
      errorHandler: {
        error: () => ErrorAction.Continue,
        closed: () => CloseAction.DoNotRestart,
      },
    },
    connectionProvider: createIpcConnectionProvider(bridge),
  });

  await languageClient.start();
  client = languageClient;
}

export async function stopTexlabLanguageClient(): Promise<void> {
  const active = client;
  client = null;
  if (active) {
    try {
      await active.stop();
    } catch {
      // Session may already be closed (e.g. project closed while typing).
    }
  }
  disposeAllLspEditorDocuments();
  bridge?.dispose();
  bridge = null;
}
