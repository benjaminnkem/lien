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
    default: "Lien — One asset, one first claim",
    template: "%s · Lien",
  },
  description:
    "The pre-collateralization integrity layer for verified real-world assets.",
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
