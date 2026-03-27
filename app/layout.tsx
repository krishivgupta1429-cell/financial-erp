import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gupta Family Finance",
  description: "Personal Financial ERP for the Gupta Family",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-900 text-slate-100">{children}</body>
    </html>
  );
}
