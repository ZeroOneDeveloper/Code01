import React from "react";

import { createClient } from "@lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (user["user"]) {
    return <div className="min-h-screen"></div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow flex flex-col">
        <div className="flex-1" />
        <div className="w-2/3 md:w-1/2 mx-auto">
          <h1 className="text-black dark:text-white font-black text-3xl md:text-4xl lg:text-6xl text-shadow-lg/50 text-shadow-black/50 dark:text-shadow-[#4f46e5]/50 text-left">
            Solve from 0 to 1.
          </h1>
          <h1 className="text-black dark:text-white font-black text-2xl md:text-3xl lg:text-4xl text-shadow-lg text-right">
            강릉원주대 컴공 온라인 저지
          </h1>
        </div>
        <div className="flex-1" />
      </main>
    </div>
  );
}
