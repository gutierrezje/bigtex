import { ComposerPrimitive, useAui } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import { appendAgentHandoffToComposer } from "../../../../shared/problems";
import { useAppStore } from "../../store";

export function AgentComposer() {
  const aui = useAui();
  const draft = useAppStore((state) => state.agentComposerDraft);
  const pendingHandoffLine = useAppStore((state) => state.pendingHandoffLine);
  const focusToken = useAppStore((state) => state.agentComposerFocusToken);
  const setAgentComposerDraft = useAppStore((state) => state.setAgentComposerDraft);
  const clearPendingHandoffLine = useAppStore((state) => state.clearPendingHandoffLine);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!pendingHandoffLine) return;

    const merged = appendAgentHandoffToComposer(aui.composer().getState().text, pendingHandoffLine);
    aui.composer().setText(merged);
    setAgentComposerDraft(merged);
    clearPendingHandoffLine();
  }, [focusToken, pendingHandoffLine, aui, setAgentComposerDraft, clearPendingHandoffLine]);

  useEffect(() => {
    if (draft !== "") return;
    aui.composer().setText("");
  }, [draft, aui]);

  useEffect(() => {
    if (focusToken === 0) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = aui.composer().getState().text.length;
    input.setSelectionRange(end, end);
  }, [focusToken, aui]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-surface-inset p-2">
      <ComposerPrimitive.Input
        ref={inputRef}
        className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Ask BigTeX to revise, explain, or fix this LaTeX..."
        rows={2}
        submitMode="enter"
      />
      <div className="flex items-end">
        <ComposerPrimitive.Send className="rounded-md border-0 bg-accent px-3 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-100 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          Send
        </ComposerPrimitive.Send>
      </div>
    </div>
  );
}
