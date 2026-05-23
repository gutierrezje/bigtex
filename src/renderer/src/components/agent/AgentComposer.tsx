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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded border border-border bg-surface-inset p-2 focus-within:border-accent/30 transition-colors duration-150">
      <ComposerPrimitive.Input
        ref={inputRef}
        className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-xs leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Ask BigTeX to revise, explain, or fix..."
        rows={2}
        submitMode="enter"
      />
      <div className="flex items-end select-none">
        <ComposerPrimitive.Send className="rounded border border-accent/20 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:bg-transparent disabled:border-border/50 disabled:text-text-muted/40 transition-all cursor-pointer">
          send
        </ComposerPrimitive.Send>
      </div>
    </div>
  );
}
