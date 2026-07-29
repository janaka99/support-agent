import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth";

export const metadata: Metadata = {
  title: "Support Agent",
  description: "AI-powered customer support platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
