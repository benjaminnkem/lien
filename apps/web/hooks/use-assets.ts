"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type {
  Asset,
  AuditEvent,
  CreateFingerprintInput,
  EncumbranceResult,
  FinanceInput,
  FinanceResult,
  FingerprintResult,
} from "@/lib/asset-types";

export const assetKeys = {
  all: ["assets"] as const,
  list: () => [...assetKeys.all, "list"] as const,
  auditRoot: () => [...assetKeys.all, "audit"] as const,
  audit: (fingerprint?: string) =>
    [...assetKeys.auditRoot(), fingerprint || "all"] as const,
};

export function useAssets() {
  return useQuery({
    queryKey: assetKeys.list(),
    queryFn: () => apiGet<Asset[]>("/assets?limit=100"),
  });
}

export function useAuditEvents(fingerprint?: string) {
  const search = new URLSearchParams({ limit: "100" });
  if (fingerprint) search.set("fingerprint", fingerprint);

  return useQuery({
    queryKey: assetKeys.audit(fingerprint),
    queryFn: () => apiGet<AuditEvent[]>(`/assets/audit?${search.toString()}`),
  });
}

export function useCreateFingerprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFingerprintInput) =>
      apiPost<FingerprintResult, CreateFingerprintInput>(
        "/assets/fingerprint",
        input,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assetKeys.list() }),
        queryClient.invalidateQueries({ queryKey: assetKeys.auditRoot() }),
      ]);
    },
  });
}

export function useCheckEncumbrance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fingerprint: string) =>
      apiPost<EncumbranceResult, { fingerprint: string }>("/assets/check", {
        fingerprint,
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: assetKeys.auditRoot(),
      });
    },
  });
}

export function useFinanceAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: FinanceInput) =>
      apiPost<FinanceResult, FinanceInput>("/assets/finance", input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assetKeys.list() }),
        queryClient.invalidateQueries({ queryKey: assetKeys.auditRoot() }),
      ]);
    },
  });
}
