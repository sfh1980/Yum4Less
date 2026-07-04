import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeSync } from "@/components/theme-sync";
import "./theme-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yum4Less",
  description: "Budget-aware dinner planning built around local store pricing.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
