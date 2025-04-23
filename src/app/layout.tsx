// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Ensure Tailwind CSS is imported

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "doctato - AI Codebase Tutorial Generator",
  description: "Generate tutorials from codebases using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} dark:bg-gray-900 min-h-full`}>{children}</body>
    </html>
  );
}