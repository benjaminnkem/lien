import type { Metadata } from "next";
import { LenderPage } from "@/components/lender/lender-page";

export const metadata: Metadata = {
  title: "Lender",
  description: "Finance a clean asset once and block a duplicate claim.",
};

export default function Page() {
  return <LenderPage />;
}
