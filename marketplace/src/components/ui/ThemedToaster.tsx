"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/providers/theme-provider";

export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-right"
      theme={theme}
      richColors
      closeButton
    />
  );
}
