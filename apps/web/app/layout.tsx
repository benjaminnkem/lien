import type { Metadata } from "next";
import { Geist_Mono, Outfit, Raleway } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const heading = Raleway({
  subsets: ["latin"],
  variable: "--font-heading",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "LIEN — Stop double-spending the real-world asset",
    template: "%s · LIEN",
  },
  description:
    "On-chain encumbrance infrastructure for tokenized RWAs. Canonical obligation identity, atomic reservation, cross-protocol enforcement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        sans.variable,
        heading.variable,
        mono.variable,
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppProviders>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
