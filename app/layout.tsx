import type { Metadata, Viewport } from "next";
import "./globals.css";
import QueryProvider from "@/components/providers/query-provider";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Fall back to default URL below
    }
  }
  return "https://hy-ops-frontend.vercel.app";
})();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HYOps — Inventory, Warehouse & Fleet Operations",
    template: "%s | HYOps",
  },
  description:
    "HYOps connects inventory, warehouse management, orders, payments, real-time fleet tracking, and delivery scheduling in one unified operations workspace.",
  applicationName: "HYOps",
  keywords: [
    "HYOps",
    "HyOps",
    "inventory management",
    "warehouse management",
    "fleet tracking",
    "delivery scheduling",
    "order management",
    "logistics operations",
    "supply chain workspace",
  ],
  authors: [{ name: "HYOps" }],
  creator: "HYOps",
  publisher: "HYOps",
  category: "business",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/hy-ops-logo.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: ["/hy-ops-logo.png"],
    apple: [{ url: "/hy-ops-logo.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "HYOps",
    title: "HYOps — Inventory, Warehouse & Fleet Operations",
    description:
      "Keep inventory, warehouses, orders, deliveries, and your fleet connected in one real-time operational workspace.",
    images: [
      {
        url: "/hy-ops-logo.png",
        width: 340,
        height: 301,
        alt: "HYOps Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "HYOps — Inventory, Warehouse & Fleet Operations",
    description:
      "Keep inventory, warehouses, orders, deliveries, and your fleet connected in one real-time operational workspace.",
    images: ["/hy-ops-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "HYOps",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  image: `${SITE_URL}/hy-ops-logo.png`,
  description:
    "HYOps connects inventory, warehouse management, orders, payments, real-time fleet tracking, and delivery scheduling in one unified operations workspace.",
  publisher: {
    "@type": "Organization",
    name: "HYOps",
    url: SITE_URL,
    logo: `${SITE_URL}/hy-ops-logo.png`,
  },
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
      className="font-sans"
      suppressHydrationWarning
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
