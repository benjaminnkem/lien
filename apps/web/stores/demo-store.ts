"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DemoStage =
  | "ready"
  | "fingerprinted"
  | "clean"
  | "financed"
  | "blocked";

type DemoStore = {
  fingerprint: string | null;
  invoiceNumber: string | null;
  selectedFingerprint: string | null;
  stage: DemoStage;
  firstLienId: string | null;
  demoConfig: {
    chain: string;
    atokenAddress: string;
    issuer: { cvi: string; wallet: string };
    lenderA: { cvi: string; wallet: string };
    lenderB: { cvi: string; wallet: string };
    debtorCvi: string;
  } | null;
  setAsset: (fingerprint: string, invoiceNumber: string) => void;
  markClean: () => void;
  markFinanced: (lienId: string) => void;
  markBlocked: () => void;
  loadSeed: (input: {
    fingerprint: string;
    invoiceNumber: string;
    lienId: string;
    blocked: boolean;
    config: NonNullable<DemoStore["demoConfig"]>;
  }) => void;
  selectFingerprint: (fingerprint: string | null) => void;
  reset: () => void;
};

const initialState = {
  fingerprint: null,
  invoiceNumber: null,
  selectedFingerprint: null,
  stage: "ready" as DemoStage,
  firstLienId: null,
  demoConfig: null,
};

export const useDemoStore = create<DemoStore>()(
  persist(
    (set) => ({
      ...initialState,
      setAsset: (fingerprint, invoiceNumber) =>
        set({
          fingerprint,
          selectedFingerprint: fingerprint,
          invoiceNumber,
          stage: "fingerprinted",
          firstLienId: null,
        }),
      markClean: () => set({ stage: "clean" }),
      markFinanced: (firstLienId) => set({ stage: "financed", firstLienId }),
      markBlocked: () => set({ stage: "blocked" }),
      loadSeed: ({ fingerprint, invoiceNumber, lienId, blocked, config }) =>
        set({
          fingerprint,
          selectedFingerprint: fingerprint,
          invoiceNumber,
          firstLienId: lienId,
          stage: blocked ? "blocked" : "financed",
          demoConfig: config,
        }),
      selectFingerprint: (selectedFingerprint) => set({ selectedFingerprint }),
      reset: () => set(initialState),
    }),
    {
      name: "lien-demo-session",
      version: 1,
      partialize: (state) => ({
        fingerprint: state.fingerprint,
        invoiceNumber: state.invoiceNumber,
        selectedFingerprint: state.selectedFingerprint,
        stage: state.stage,
        firstLienId: state.firstLienId,
        demoConfig: state.demoConfig,
      }),
    },
  ),
);
