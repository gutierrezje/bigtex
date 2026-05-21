import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_NEW_FILE_TEMPLATE_ID,
  NEW_FILE_TEMPLATES,
  resolveNewFileName,
  templateById,
} from "../../../shared/newFileTemplates";

interface NewFileDialogProps {
  open: boolean;
  parentLabel: string;
  onCancel(): void;
  onCreate(fileName: string): void | Promise<void>;
}

export function NewFileDialog({ open, parentLabel, onCancel, onCreate }: NewFileDialogProps) {
  const titleId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState(DEFAULT_NEW_FILE_TEMPLATE_ID);
  const [stem, setStem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const template = templateById(templateId) ?? NEW_FILE_TEMPLATES[0];

  useEffect(() => {
    if (!open) return;
    setTemplateId(DEFAULT_NEW_FILE_TEMPLATE_ID);
    setStem(NEW_FILE_TEMPLATES[0].defaultStem);
    setError(null);
    setSubmitting(false);
    const frame = requestAnimationFrame(() => nameInputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  async function handleSubmit(): Promise<void> {
    const fileName = resolveNewFileName(stem, template.extension);
    if (!fileName) {
      setError("Enter a valid file name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(fileName);
    } catch {
      setSubmitting(false);
      setError("Could not create file.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid w-full max-w-md gap-4 rounded-xl border border-border bg-surface-raised p-4 shadow-2xl"
      >
        <header>
          <h2 id={titleId} className="text-sm font-semibold text-text-primary">
            Add New File
          </h2>
          <p className="mt-1 text-xs text-text-muted">Location: {parentLabel || "project root"}</p>
        </header>

        <div className="grid gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            File type
          </span>
          <ul className="m-0 max-h-48 list-none overflow-y-auto rounded-lg border border-border-subtle p-1">
            {NEW_FILE_TEMPLATES.map((entry) => {
              const selected = entry.id === templateId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col rounded-md px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? "bg-accent-muted text-text-primary"
                        : "text-text-secondary hover:bg-zinc-800/50 hover:text-text-primary"
                    }`}
                    onClick={() => {
                      setTemplateId(entry.id);
                      setStem(entry.defaultStem);
                      setError(null);
                    }}
                  >
                    <span className="text-xs font-medium">
                      {entry.label}{" "}
                      <span className="font-mono text-text-muted">{entry.extension}</span>
                    </span>
                    <span className="text-[11px] text-text-muted">{entry.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Name
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-900 px-2 py-1.5 focus-within:border-accent/50">
            <input
              ref={nameInputRef}
              type="text"
              value={stem}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text-primary outline-none"
              onChange={(event) => {
                setStem(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
            <span className="shrink-0 font-mono text-xs text-text-muted">{template.extension}</span>
          </div>
          {error ? <span className="text-xs text-danger">{error}</span> : null}
        </label>

        <footer className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-accent/30 bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 disabled:opacity-50"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            Create
          </button>
        </footer>
      </div>
    </div>
  );
}
