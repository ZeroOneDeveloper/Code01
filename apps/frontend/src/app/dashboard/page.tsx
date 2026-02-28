import { redirect } from "next/navigation";
import {
  BookOpenText,
  Building2,
  CheckCheck,
  ClipboardList,
  Code2,
  Mail,
  Users,
  UserCheck,
} from "lucide-react";

import { formatMemoryKb } from "@lib/format-memory";
import { createClient } from "@lib/supabase/server";

type SubmissionRow = {
  id: number;
  user_id: string;
  problem_id: number;
  passed_all: boolean;
  status_code: number;
  submitted_at: string;
  language: string;
  time_ms: number;
  memory_kb: number;
};

type SubmissionUserRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
};

type SubmissionProblemRow = {
  id: number;
  title: string;
};

type PendingSignupRow = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
};

const formatNumber = (value: number) => value.toLocaleString("ko-KR");

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};

const statusText = (statusCode: number, passedAll: boolean) => {
  if (passedAll || statusCode === 1) return "정답";
  switch (statusCode) {
    case 0:
      return "대기중";
    case 2:
      return "오답";
    case 3:
      return "시간 초과";
    case 4:
      return "메모리 초과";
    case 5:
      return "런타임 에러";
    case 6:
      return "컴파일 에러";
    case 7:
      return "시스템 에러";
    default:
      return "결과 없음";
  }
};

const statusBadgeClass = (statusCode: number, passedAll: boolean) => {
  if (passedAll || statusCode === 1) {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300";
  }
  if (statusCode === 0) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300";
  }
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300";
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export default async function DashboardPage() {
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

  const [
    usersCountRes,
    organizationsCountRes,
    problemsCountRes,
    submissionsCountRes,
    acceptedSubmissionsCountRes,
    quizzesCountRes,
    pendingSignupsCountRes,
    recentSubmissionsRes,
    submissionsForChartRes,
    recentPendingSignupsRes,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("problems").select("id", { count: "exact", head: true }),
    supabase
      .from("problem_submissions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("problem_submissions")
      .select("id", { count: "exact", head: true })
      .eq("passed_all", true),
    supabase.from("quizzes").select("id", { count: "exact", head: true }),
    supabase.from("pending_signups").select("id", { count: "exact", head: true }),
    supabase
      .from("problem_submissions")
      .select(
        "id, user_id, problem_id, passed_all, status_code, submitted_at, language, time_ms, memory_kb",
      )
      .order("submitted_at", { ascending: false })
      .range(0, 14),
    supabase
      .from("problem_submissions")
      .select("id, user_id, submitted_at")
      .order("submitted_at", { ascending: false })
      .range(0, 1999),
    supabase
      .from("pending_signups")
      .select("id, email, created_at, expires_at")
      .order("created_at", { ascending: false })
      .range(0, 9),
  ]);

  const totalUsers = usersCountRes.count ?? 0;
  const totalOrganizations = organizationsCountRes.count ?? 0;
  const totalProblems = problemsCountRes.count ?? 0;
  const totalSubmissions = submissionsCountRes.count ?? 0;
  const acceptedSubmissions = acceptedSubmissionsCountRes.count ?? 0;
  const totalQuizzes = quizzesCountRes.count ?? 0;
  const totalPendingSignups = pendingSignupsCountRes.count ?? 0;

  const acceptanceRate =
    totalSubmissions > 0 ? (acceptedSubmissions / totalSubmissions) * 100 : 0;

  const recentSubmissions = (recentSubmissionsRes.data ?? []) as SubmissionRow[];
  const recentPendingSignups = (recentPendingSignupsRes.data ??
    []) as PendingSignupRow[];

  const recentUserIds = Array.from(
    new Set(recentSubmissions.map((submission) => submission.user_id)),
  );
  const recentProblemIds = Array.from(
    new Set(recentSubmissions.map((submission) => submission.problem_id)),
  );

  const [recentUsersRes, recentProblemsRes] = await Promise.all([
    recentUserIds.length > 0
      ? supabase
          .from("users")
          .select("id, name, nickname, email")
          .in("id", recentUserIds)
      : Promise.resolve({ data: [] as SubmissionUserRow[] }),
    recentProblemIds.length > 0
      ? supabase
          .from("problems")
          .select("id, title")
          .in("id", recentProblemIds)
      : Promise.resolve({ data: [] as SubmissionProblemRow[] }),
  ]);

  const userMap = Object.fromEntries(
    ((recentUsersRes.data ?? []) as SubmissionUserRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const problemMap = Object.fromEntries(
    ((recentProblemsRes.data ?? []) as SubmissionProblemRow[]).map((row) => [
      row.id,
      row,
    ]),
  );

  const rawChartRows = (submissionsForChartRes.data ?? []) as {
    id: number;
    user_id: string;
    submitted_at: string;
  }[];
  const activeUser7Days = new Set<string>();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayBuckets = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (6 - offset));
    return {
      key: dayKey(date),
      label: date.toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      }),
      count: 0,
    };
  });
  const chartMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));
  const startKey = dayBuckets[0]?.key;

  for (const row of rawChartRows) {
    const submittedAt = new Date(row.submitted_at);
    if (Number.isNaN(submittedAt.getTime())) continue;
    const key = dayKey(submittedAt);
    if (!startKey || key < startKey) continue;
    const bucket = chartMap.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    activeUser7Days.add(row.user_id);
  }

  const maxDailyCount = Math.max(1, ...dayBuckets.map((bucket) => bucket.count));

  const stats = [
    {
      title: "회원 수",
      value: formatNumber(totalUsers),
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      subtext: "전체 가입 사용자",
    },
    {
      title: "조직 수",
      value: formatNumber(totalOrganizations),
      icon: Building2,
      color: "text-orange-600 dark:text-orange-400",
      subtext: "공개/비공개 포함",
    },
    {
      title: "문제 수",
      value: formatNumber(totalProblems),
      icon: BookOpenText,
      color: "text-indigo-600 dark:text-indigo-400",
      subtext: "등록된 전체 문제",
    },
    {
      title: "제출 수",
      value: formatNumber(totalSubmissions),
      icon: Code2,
      color: "text-purple-600 dark:text-purple-400",
      subtext: "모든 제출 기록",
    },
    {
      title: "정답률",
      value: `${acceptanceRate.toFixed(1)}%`,
      icon: CheckCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      subtext: `정답 ${formatNumber(acceptedSubmissions)}건`,
    },
    {
      title: "퀴즈 수",
      value: formatNumber(totalQuizzes),
      icon: ClipboardList,
      color: "text-cyan-600 dark:text-cyan-400",
      subtext: "생성된 퀴즈",
    },
  ];

  return (
    <div className="w-full flex-1 bg-dark text-gray-100">
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              현재 시스템 데이터 기준으로 집계된 지표입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div
                      className={`flex-shrink-0 p-3 bg-gray-100 dark:bg-neutral-800/90 rounded-lg ${stat.color}`}
                    >
                      <stat.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          {stat.title}
                        </dt>
                        <dd className="flex items-baseline">
                          <span className="text-2xl font-semibold">
                            {stat.value}
                          </span>
                        </dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    {stat.subtext}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">최근 7일 제출 추세</h3>
                <div className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <UserCheck className="h-4 w-4" />
                  활성 사용자 {formatNumber(activeUser7Days.size)}명
                </div>
              </div>
              <div className="flex items-end justify-around h-64 w-full space-x-2">
                {dayBuckets.map((bucket) => (
                  <div
                    key={bucket.key}
                    className="flex flex-col items-center space-y-2 w-full"
                  >
                    <div
                      className="w-full bg-blue-400 dark:bg-blue-500 rounded-t-lg"
                      style={{
                        height: `${(bucket.count / maxDailyCount) * 100}%`,
                      }}
                    ></div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {bucket.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {bucket.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">가입 대기</h3>
                <div className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <Mail className="h-4 w-4" />
                  {formatNumber(totalPendingSignups)}건
                </div>
              </div>

              {recentPendingSignups.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  현재 가입 대기 데이터가 없습니다.
                </div>
              ) : (
                <ul className="space-y-3">
                  {recentPendingSignups.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md border border-gray-200/70 dark:border-neutral-700/70 p-3"
                    >
                      <div className="text-sm font-medium truncate">{row.email}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        신청: {formatDateTime(row.created_at)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        만료: {formatDateTime(row.expires_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900/70 rounded-xl shadow-sm border border-gray-200/70 dark:border-neutral-700/70 p-6">
            <h3 className="font-semibold text-lg mb-4">최근 제출 15건</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-neutral-700/80 text-left">
                    <th className="py-2 pr-4">시간</th>
                    <th className="py-2 pr-4">사용자</th>
                    <th className="py-2 pr-4">문제</th>
                    <th className="py-2 pr-4">언어</th>
                    <th className="py-2 pr-4">실행시간</th>
                    <th className="py-2 pr-4">메모리</th>
                    <th className="py-2 pr-4">결과</th>
                    <th className="py-2">보기</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-6 text-center text-gray-500 dark:text-gray-400"
                      >
                        제출 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    recentSubmissions.map((submission) => {
                      const submissionUser = userMap[submission.user_id];
                      const submissionProblem = problemMap[submission.problem_id];
                      const displayName =
                        submissionUser?.nickname ||
                        submissionUser?.name ||
                        submissionUser?.email ||
                        submission.user_id;

                      return (
                        <tr
                          key={submission.id}
                          className="border-b border-gray-100 dark:border-neutral-800/80"
                        >
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {formatDateTime(submission.submitted_at)}
                          </td>
                          <td className="py-2 pr-4 max-w-[220px] truncate">
                            {displayName}
                          </td>
                          <td className="py-2 pr-4 max-w-[280px] truncate">
                            {submissionProblem
                              ? `#${submissionProblem.id} ${submissionProblem.title}`
                              : `#${submission.problem_id}`}
                          </td>
                          <td className="py-2 pr-4 uppercase">{submission.language}</td>
                          <td className="py-2 pr-4">{submission.time_ms} ms</td>
                          <td className="py-2 pr-4">
                            {formatMemoryKb(submission.memory_kb)}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(submission.status_code, submission.passed_all)}`}
                            >
                              {statusText(submission.status_code, submission.passed_all)}
                            </span>
                          </td>
                          <td className="py-2">
                            <a
                              href={`/problem/${submission.problem_id}/submissions/${submission.id}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              상세
                            </a>
                          </td>
                        </tr>
                      );
                    })
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
