// Server action to update user profile
"use server";

import { revalidatePath } from "next/cache";

export async function updateUserProfile(
  student_id: string,
  nickname: string,
  name: string,
): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("users")
    .update({ student_id, nickname, name })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

import React from "react";

import { createClient } from "@lib/supabase/server";

import { UserProfile } from "@lib/types";
import DashboardForm from "@components/DashboardForm";

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
      <div className="flex justify-center items-center pt-20 pb-10 bg-darkfh text-white min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl bg-black rounded-lg p-6">
          <h1 className="text-xl font-semibold">
            사용자 정보를 찾을 수 없습니다.
          </h1>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center items-center pt-20 pb-10 bg-darkfh text-white min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-black rounded-lg">
        <aside className="w-full md:w-64 p-6 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 rounded-t-lg md:rounded-t-none md:rounded-l-lg">
          <h2 className="text-xl font-semibold mb-6">Account</h2>
          <nav className="flex flex-col space-y-3">
            <button className="text-left text-white font-medium bg-zinc-800 px-4 py-2 rounded">
              Profile
            </button>
          </nav>
        </aside>
        <main className="flex-1 p-6 md:p-8 rounded-b-lg md:rounded-b-none md:rounded-r-lg">
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
