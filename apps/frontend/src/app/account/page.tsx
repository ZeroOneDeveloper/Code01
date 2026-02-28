import { updateUserProfile } from "./action";

import React from "react";
import { BadgeCheck, Mail, UserRound } from "lucide-react";

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
      <div className="flex flex-1 justify-center items-center py-10 bg-dark text-white px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl rounded-xl border border-gray-700 bg-[#181b24] p-6">
          <h1 className="text-xl font-semibold text-white">
            사용자 정보를 찾을 수 없습니다.
          </h1>
        </div>
      </div>
    );
  }

  const displayName =
    userProfile.name || userProfile.nickname || userProfile.email;
  const roleLabel = userProfile.is_admin ? "관리자" : "유저";
  const initial = (displayName?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex flex-1 justify-center bg-dark text-white px-4 sm:px-6 lg:px-8 py-8">
      <div className="w-full max-w-5xl space-y-6">
        <div className="border-b border-gray-700/70 pb-4">
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="mt-1 text-sm text-gray-400">
            계정 기본 정보와 프로필을 관리합니다.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-gray-700 bg-[#181b24] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/20 text-lg font-bold text-teal-300">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-100">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400">{roleLabel}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="truncate">{userProfile.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <UserRound className="h-4 w-4 text-gray-400" />
                <span>닉네임: {userProfile.nickname || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <BadgeCheck className="h-4 w-4 text-gray-400" />
                <span>학번: {userProfile.student_id || "-"}</span>
              </div>
            </div>
          </aside>

          <main className="rounded-xl border border-gray-700 bg-[#181b24] p-6 md:p-7">
            <DashboardForm
              user={userProfile as UserProfile}
              updateUserProfile={updateUserProfile}
            />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
