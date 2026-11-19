import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "~/styles/product-tokens.css";
import "~/styles/fonts.css";
import "~/styles/japanese-ink.css";
import { GlobalProviders } from "~/providers/global";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Sumikami",
  description: "Make every question an experience.",
  icons: { icon: "/brand/icon.svg", shortcut: "/brand/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/noto-serif-jp-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className={geistMono.variable}>
        <ClerkProvider>
          <GlobalProviders>{children}</GlobalProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
