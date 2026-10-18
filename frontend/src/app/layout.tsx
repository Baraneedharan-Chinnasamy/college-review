import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { Navbar, NavbarFallback } from "@/components/navbar";
import { ToastProvider } from "@/components/toast";

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
  title: {
    default: "CollegeReview — honest reviews of Indian colleges",
    template: "%s · CollegeReview",
  },
  description:
    "Browse colleges, compare average ratings and read reviews written by students and teachers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<NavbarFallback />}>
              <Navbar />
            </Suspense>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p>
                  CollegeReview — a College Review System built with FastAPI, MongoDB and Next.js.
                </p>
                <p>Reviews reflect the opinions of their authors.</p>
              </div>
            </footer>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
