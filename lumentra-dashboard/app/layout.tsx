import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lumentra - AI Voice Agent for Business",
  description:
    "Never miss a call. Lumentra handles your business calls 24/7 with human-like AI. Book appointments, answer questions, and grow your business.",
  keywords: [
    "AI voice agent",
    "business phone",
    "automated calls",
    "appointment booking",
    "customer service",
  ],
  authors: [{ name: "Lumentra" }],
  openGraph: {
    title: "Lumentra - AI Voice Agent for Business",
    description:
      "Never miss a call. Lumentra handles your business calls 24/7 with human-like AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
