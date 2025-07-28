import React from "react";
import type { Metadata } from "next";

import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";

import "./globals.css";
import Header from "@components/Header";
import Footer from "@components/Footer";

export const metadata: Metadata = {
  title: "Code01",
  description: "Solve from 0 to 1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className="dark:bg-dark bg-white transition-colors duration-500 ease-in-out text-black dark:text-white">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          {children}
          <Footer />
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
