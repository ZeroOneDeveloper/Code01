import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Crown, Users } from "lucide-react";

import { createClient } from "@lib/supabase/server";
import AdminToggle from "./AdminToggle";

type UserRow = {
  id: string;
  is_admin: boolean;
  student_id: string | null;
  name: string | null;
  nickname: string | null;
  email: string;
  created_at: string;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};

export default async function DashboardUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return redirect("/");
  }

  const { data: usersData } = await supabase
    .from("users")
    .select("id, is_admin, student_id, name, nickname, email, created_at")
    .order("created_at", { ascending: false });

  const users = (usersData ?? []) as UserRow[];

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.is_admin).length;

  return (
    <div className="w-full flex-1 bg-dark text-gray-100">
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              회원 관리
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              가입한 사용자 목록을 확인하고 관리자 권한을 부여할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-gray-100 dark:bg-neutral-800/90 rounded-lg text-blue-600 dark:text-blue-400">
                  <Users className="h-6 w-6" />
                </div>
                <div className="ml-5">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    전체 회원
                  </div>
                  <div className="text-2xl font-semibold">
                    {totalUsers.toLocaleString("ko-KR")}명
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-gray-100 dark:bg-neutral-800/90 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Crown className="h-6 w-6" />
                </div>
                <div className="ml-5">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    관리자
                  </div>
                  <div className="text-2xl font-semibold">
                    {adminCount.toLocaleString("ko-KR")}명
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-6">
            <h3 className="font-semibold text-lg mb-4">사용자 목록</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-neutral-700/80 text-left">
                    <th className="py-2 pr-4">이름</th>
                    <th className="py-2 pr-4">닉네임</th>
                    <th className="py-2 pr-4">이메일</th>
                    <th className="py-2 pr-4">학번</th>
                    <th className="py-2 pr-4">가입일</th>
                    <th className="py-2 pr-4 text-center">관리자</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-gray-500 dark:text-gray-400"
                      >
                        등록된 사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-100 dark:border-neutral-800/80"
                      >
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {u.name || "-"}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {u.nickname || "-"}
                        </td>
                        <td className="py-2 pr-4 max-w-[240px] truncate">
                          {u.email}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {u.student_id || "-"}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {formatDateTime(u.created_at)}
                        </td>
                        <td className="py-2 pr-4 text-center">
                          <AdminToggle
                            userId={u.id}
                            initialValue={u.is_admin}
                            isSelf={u.id === user.id}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
