import React, { createContext, useContext, useMemo, useRef, useState } from "react";

export type Draft = {
  transcript: string;
  capture_method: string;
  audio_sha256: string;
};

type DraftState = {
  draft: Draft;
  setDraft: (d: Partial<Draft>) => void;
  reset: () => void;
};

const EMPTY: Draft = { transcript: "", capture_method: "", audio_sha256: "" };

const DraftContext = createContext<DraftState | undefined>(undefined);

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<Draft>(EMPTY);
  const ref = useRef(draft);
  ref.current = draft;

  const value = useMemo<DraftState>(
    () => ({
      draft,
      setDraft: (d) => setDraftState({ ...ref.current, ...d }),
      reset: () => setDraftState(EMPTY),
    }),
    [draft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
