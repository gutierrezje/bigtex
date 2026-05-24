import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_NEW_FOLDER_NAME, resolveFolderName } from "../../../shared/projectFiles";

interface NewFolderDialogProps {
  open: boolean;
  parentLabel: string;
  onCancel(): void;
  onCreate(folderName: string): void | Promise<void>;
}

export function NewFolderDialog({ open, parentLabel, onCancel, onCreate }: NewFolderDialogProps) {
  const titleId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(DEFAULT_NEW_FOLDER_NAME);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(DEFAULT_NEW_FOLDER_NAME);
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
    const folderName = resolveFolderName(name);
    if (!folderName) {
      setError("Enter a valid folder name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(folderName);
    } catch {
      setSubmitting(false);
      setError("Could not create folder.");
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
            Add New Folder
          </h2>
          <p className="mt-1 text-xs text-text-muted">Location: {parentLabel || "project root"}</p>
        </header>

        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Name
          </span>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            className="rounded-lg border border-border bg-zinc-900 px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
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
