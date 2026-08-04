import type { Metadata } from "next";
import { CompliancePage } from "@/components/compliance/compliance-page";

export const metadata: Metadata = {
  title: "Compliance",
  description: "Review the audit trail for every registry decision.",
};

export default function Page() {
  return <CompliancePage />;
}
