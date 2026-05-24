/** Language Server Protocol Content-Length header framing (stdio). */

export function formatLspMessage(payload: unknown): string {
  const body = JSON.stringify(payload);
  const bytes = Buffer.byteLength(body, "utf8");
  return `Content-Length: ${bytes}\r\n\r\n${body}`;
}

export class LspMessageReader {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const messages: string[] = [];

    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (this.buffer.length < bodyEnd) break;

      messages.push(this.buffer.slice(bodyStart, bodyEnd));
      this.buffer = this.buffer.slice(bodyEnd);
    }

    return messages;
  }
}
