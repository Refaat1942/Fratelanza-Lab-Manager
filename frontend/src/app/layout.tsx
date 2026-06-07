import type { Metadata } from "next";
import { Tajawal, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { BrandingTheme } from "@/components/branding/branding-theme";
import { LocaleDirection } from "@/components/layout/locale-direction";
import "./globals.css";

const tajawal = Tajawal({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LabMaster Egypt - Laboratory ERP & LIMS",
  description: "Complete SaaS ERP and Laboratory Information Management System for Egypt and the Middle East",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${tajawal.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <TooltipProvider delay={0}>
          <LocaleDirection />
          <BrandingTheme />
          {children}
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
