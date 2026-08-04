import type { Metadata } from "next";
import { IssuerPage } from "@/components/issuer/issuer-page";

export const metadata: Metadata = {
  title: "Issuer",
  description: "Create an invoice fingerprint and prove the registry is clean.",
};

export default function Page() {
  return <IssuerPage />;
}
