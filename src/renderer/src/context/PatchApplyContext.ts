import { createContext, useContext } from "react";

export const PatchApplyContext = createContext<((patch: string) => Promise<void>) | null>(null);

export function usePatchApply(): ((patch: string) => Promise<void>) | null {
  return useContext(PatchApplyContext);
}
