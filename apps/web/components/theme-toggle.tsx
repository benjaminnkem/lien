"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/75 bg-muted/55 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
        className,
      )}
    >
      <Sun
        className={cn(
          "size-4 transition-all duration-300",
          isDark
            ? "scale-0 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-300",
          isDark
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 -rotate-90 opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}
