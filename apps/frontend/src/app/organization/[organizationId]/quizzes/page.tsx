"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { createClient } from "@lib/supabase/client";

type QuizRow = {
  id: number | string;
  organization_id: number;
  title: string;
  description: string | null;
  assignment_mode?: "one_for_all" | "one_per_attempt" | "all" | string;
  problem_count?: number | null;
  global_problem_id?: number | null;
  time_limit_sec: number;
  start_at: string;
  end_at: string;
  published_at?: string | null;
  max_attempts?: number;
  created_by?: string;
  created_at?: string;
};

type StatusFilter = "all" | "upcoming" | "active" | "ended";

export default function QuizzesIndexPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingQuizId, setDeletingQuizId] = useState<number | string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!organizationId) return;
        const orgId = Number(organizationId);
        const { data, error } = await supabase
          .from("quizzes")
          .select("*")
          .eq("organization_id", orgId)
          .order("start_at", { ascending: false });
        if (error) {
          console.error(error);
          toast.error("퀴즈 목록을 불러오지 못했습니다.");
          return;
        }
        setRows(data || []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [organizationId, supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return rows
      .filter((r) => {
        if (q) {
          const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        if (statusFilter !== "all") {
          const st = statusOf(r, now);
          if (st !== statusFilter) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      );
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return rows.reduce(
      (acc, row) => {
        const st = statusOf(row, now);
        if (st === "upcoming") acc.upcoming += 1;
        if (st === "active") acc.active += 1;
        if (st === "ended") acc.ended += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, upcoming: 0, active: 0, ended: 0 },
    );
  }, [rows]);

  const handleDeleteQuiz = async (quiz: QuizRow) => {
    if (!organizationId) return;
    const ok = window.confirm(
      `퀴즈 "${quiz.title}"을(를) 삭제할까요?\n삭제 후 복구할 수 없습니다.`,
    );
    if (!ok) return;

    setDeletingQuizId(quiz.id);
    try {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quiz.id)
        .eq("organization_id", Number(organizationId));

      if (error) {
        console.error(error);
        toast.error("퀴즈 삭제에 실패했습니다.");
        return;
      }

      setRows((prev) => prev.filter((row) => row.id !== quiz.id));
      toast.success("퀴즈를 삭제했습니다.");
    } finally {
      setDeletingQuizId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 px-2 md:px-0">
      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">퀴즈</h1>
            <p className="mt-1 text-sm text-gray-400">
              예정/진행/종료 상태를 한 화면에서 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/organization/${organizationId}/quizzes/new`}
              className="rounded-md border border-teal-500/60 bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25"
            >
              새 퀴즈 만들기
            </Link>
            <button
              onClick={() => router.refresh()}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            { label: "전체", value: stats.total },
            { label: "예정", value: stats.upcoming },
            { label: "진행중", value: stats.active },
            { label: "종료", value: stats.ended },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2"
            >
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-base font-semibold text-gray-100">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5 space-y-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <input
            className="w-full rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-teal-400"
            placeholder="퀴즈 검색 (제목/설명)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5">
            {(["all", "upcoming", "active", "ended"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  statusFilter === key
                    ? "bg-primary text-white border-primary"
                    : "border-gray-600 text-gray-200 hover:bg-gray-700/40"
                }`}
                title={statusLabel(key)}
              >
                {statusLabel(key)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="border-b border-gray-700 bg-[#222736]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-100">
                  제목
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-100">
                  기간
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  상태
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  제한시간
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-100">
                  출제 방식
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  문제
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    불러오는 중…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    표시할 퀴즈가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((q) => {
                  const st = statusOf(q);
                  return (
                    <tr key={q.id} className="align-top hover:bg-[#202635]">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-100 line-clamp-1">
                          {q.title}
                        </div>
                        {q.description && (
                          <div className="mt-1 text-xs text-gray-400 line-clamp-2">
                            {q.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-300">
                        <div>{fmtKST(q.start_at)}</div>
                        <div className="mt-1">{fmtKST(q.end_at)}</div>
                      </td>
                      <td className="px-3 py-3 text-center">{statusBadge(st)}</td>
                      <td className="px-3 py-3 text-center text-gray-200">
                        {fmtTimeLimit(q.time_limit_sec)}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-300">
                        {modeLabel(q.assignment_mode)}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-200">
                        {problemInfo(q)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 min-w-[132px]">
                          <Link
                            href={`/organization/${organizationId}/quizzes/${q.id}`}
                            className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700/40 whitespace-nowrap"
                          >
                            상세
                          </Link>
                          <Link
                            href={`/organization/${organizationId}/quizzes/${q.id}/edit`}
                            className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700/40 whitespace-nowrap"
                          >
                            편집
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDeleteQuiz(q)}
                            disabled={deletingQuizId === q.id}
                            className={`rounded-md border px-2 py-1 text-xs whitespace-nowrap ${
                              deletingQuizId === q.id
                                ? "cursor-not-allowed border-rose-900 text-rose-900/70"
                                : "border-rose-600/60 text-rose-300 hover:bg-rose-500/15"
                            }`}
                          >
                            {deletingQuizId === q.id ? "삭제 중" : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */
function statusOf(
  q: { start_at: string; end_at: string },
  nowMs?: number,
): "upcoming" | "active" | "ended" {
  const now = nowMs ?? Date.now();
  const s = new Date(q.start_at).getTime();
  const e = new Date(q.end_at).getTime();
  if (now < s) return "upcoming";
  if (now > e) return "ended";
  return "active";
}

function statusLabel(s: StatusFilter) {
  return s === "all"
    ? "전체"
    : s === "upcoming"
      ? "예정"
      : s === "active"
        ? "진행중"
        : "종료";
}

function statusBadge(s: "upcoming" | "active" | "ended") {
  const cls =
    s === "active"
      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
      : s === "upcoming"
        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
        : "border-rose-500/50 bg-rose-500/15 text-rose-300";
  const label = s === "active" ? "진행중" : s === "upcoming" ? "예정" : "종료";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${cls}`}
    >
      {label}
    </span>
  );
}

function modeLabel(m?: string) {
  if (m === "one_for_all") return "전원 동일";
  if (m === "all") return "선택 전체(구형)";
  return "응시별 무작위";
}

function problemInfo(q: QuizRow) {
  const count = q.problem_count ?? null;
  if (q.assignment_mode === "one_for_all") {
    if (typeof count === "number" && count > 0) return `${count}개`;
    return q.global_problem_id ? `#${q.global_problem_id}` : "-";
  }
  if (q.assignment_mode === "all") return "전체";
  if (typeof count === "number" && count > 0) return `${count}개`;
  return "-";
}

function fmtTimeLimit(sec: number) {
  if (!sec || sec <= 0) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

function fmtKST(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}
