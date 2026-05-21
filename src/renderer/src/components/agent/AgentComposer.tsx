import { ComposerPrimitive } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../../store";

export function AgentComposer() {
  const draft = useAppStore((state) => state.agentComposerDraft);
  const setDraft = useAppStore((state) => state.setAgentComposerDraft);
  const focusToken = useAppStore((state) => state.agentComposerFocusToken);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.value = draft;
    input.focus();
    input.setSelectionRange(draft.length, draft.length);
  }, [focusToken, draft]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-surface-inset p-2">
      <ComposerPrimitive.Input
        ref={inputRef}
        className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Ask BigTeX to revise, explain, or fix this LaTeX..."
        rows={2}
        submitMode="enter"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      <div className="flex items-end">
        <ComposerPrimitive.Send className="rounded-md border-0 bg-accent px-3 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-100 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          Send
        </ComposerPrimitive.Send>
      </div>
    </div>
  );
}
