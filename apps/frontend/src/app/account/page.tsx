import { updateUserProfile } from "./action";

import React from "react";

import { createClient } from "@lib/supabase/server";

import { UserProfile } from "@lib/types";
import DashboardForm from "@components/hero/DashboardForm";

const DashboardPage: React.FC = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user?.id)
    .single();
  if (!userProfile) {
    return (
      <div className="flex justify-center items-center pt-20 pb-10 bg-dark text-white min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl bg-black rounded-lg p-6">
          <h1 className="text-xl font-semibold">
            사용자 정보를 찾을 수 없습니다.
          </h1>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center items-center bg-dark text-white min-h-screen px-4 sm:px-6 lg:px-8 py-40">
      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-gray-50 dark:bg-black rounded-lg">
        <aside className="w-full md:w-64 p-6 bg-gray-200 dark:bg-zinc-900 border-b md:border-b-0 md:border-r border-gray-300 dark:border-zinc-800 rounded-t-lg md:rounded-t-none md:rounded-l-lg">
          <h2 className="text-xl font-semibold mb-6 text-black dark:text-white">
            Account
          </h2>
          <nav className="flex flex-col space-y-3">
            <button className="text-left text-white font-medium bg-gray-800 dark:bg-zinc-800 hover:bg-gray-700 dark:hover:bg-zinc-700 px-4 py-2 rounded">
              Profile
            </button>
          </nav>
        </aside>
        <main className="flex-1 p-6 md:p-8 rounded-b-lg md:rounded-b-none md:rounded-r-lg ">
          <DashboardForm
            user={userProfile as UserProfile}
            updateUserProfile={updateUserProfile}
          />
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
