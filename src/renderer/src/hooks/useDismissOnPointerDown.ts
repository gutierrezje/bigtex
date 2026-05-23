import { type RefObject, useEffect } from "react";

/** Close popovers when the user clicks or taps outside `containerRef`. */
export function useDismissOnPointerDown(
  open: boolean,
  onDismiss: () => void,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      onDismiss();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onDismiss, containerRef]);
}
