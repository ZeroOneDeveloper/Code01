import React from "react";
import type { Metadata } from "next";

import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";

import "./globals.css";
import Header from "@components/Header";
import Footer from "@components/Footer";
import { createClient } from "@lib/supabase/server";

export const metadata: Metadata = {
  title: "Code01",
  description: "Solve from 0 to 1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    userProfile = data;
  }

  return (
    <html suppressHydrationWarning className="no-transition">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}requestAnimationFrame(function(){document.documentElement.classList.remove("no-transition")})})()`,
          }}
        />
      </head>
      <body className="min-h-screen dark:bg-dark bg-white transition-colors duration-500 ease-in-out text-black dark:text-white">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen flex flex-col">
            <Header initialUser={user} initialProfile={userProfile} />
            <div className="flex-1 flex flex-col">{children}</div>
            <Footer />
          </div>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
