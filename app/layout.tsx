import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "HyOps",
  description: "HyOps Desc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-navbar-style="sticky"
      className={cn("font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
