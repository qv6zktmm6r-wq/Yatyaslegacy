import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "YAT-YAS Member Hub",
  description: "Member Hub feed, chat, and profiles for YAT-YAS Association.",
  metadataBase: new URL("https://hub.yatyasassociation.com"),
  openGraph: {
    title: "YAT-YAS Member Hub",
    description: "Member Hub feed, chat, and profiles for YAT-YAS Association.",
    images: [
      {
        url: "https://yatyasassociation.com/assets/crest-20261124.png",
        alt: "YAT-YAS Association crest",
      },
    ],
  },
  twitter: {
    card: "summary",
    images: ["https://yatyasassociation.com/assets/crest-20261124.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
