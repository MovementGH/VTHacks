import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";
import ClientAuthProvider from "./auth/authprovider";
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "InstaPC",
  description: "Run a PC with any operating system in seconds!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-screen">
      <ClientAuthProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background flex flex-col h-full`}
        >
          {children}
          <Toaster />
        </body>
      </ClientAuthProvider>
    </html>
  );
}
