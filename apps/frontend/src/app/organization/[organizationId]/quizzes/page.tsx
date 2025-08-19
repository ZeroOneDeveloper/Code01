"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { createClient } from "@lib/supabase/client";

// Quiz row type (loose to be compatible with current DB)
type QuizRow = {
  id: string;
  organization_id: number;
  title: string;
  description: string | null;
  assignment_mode?: "one_for_all" | "one_per_attempt" | "all" | string;
  global_problem_id?: number | null;
  time_limit_sec: number;
  start_at: string;
  end_at: string;
  published_at?: string | null;
  max_attempts?: number;
  created_by?: string;
  created_at?: string;
};

export default function QuizzesIndexPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "upcoming" | "active" | "ended"
  >("all");

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
  }, [organizationId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return rows
      .filter((r) => {
        // search
        if (q) {
          const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        // status
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

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">퀴즈</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            className="rounded-md border px-3 py-2 text-sm"
          >
            새로고침
          </button>
          <Link
            href={`/organization/${organizationId}/quizzes/new`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            새 퀴즈 만들기
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-md border p-3 flex flex-wrap items-center gap-2">
        <input
          className="rounded-md border bg-transparent px-3 py-2 text-sm flex-1 min-w-[220px]"
          placeholder="퀴즈 검색 (제목/설명)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-1">
          {(["all", "upcoming", "active", "ended"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-2 text-sm rounded-md border ${
                statusFilter === key
                  ? "bg-primary text-white border-primary"
                  : "hover:bg-muted/40"
              }`}
              title={statusLabel(key as any)}
            >
              {statusLabel(key as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-2 text-center">제목</th>
              <th className="p-2 text-center">기간</th>
              <th className="p-2 text-center">상태</th>
              <th className="p-2 text-center">제한시간</th>
              <th className="p-2 text-center">출제 방식</th>
              <th className="p-2 text-center">문제</th>
              <th className="p-2 text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-muted-foreground"
                >
                  불러오는 중…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-muted-foreground"
                >
                  표시할 퀴즈가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((q) => {
                const st = statusOf(q);
                return (
                  <tr key={q.id} className="align-middle">
                    <td className="p-2 text-center align-middle">
                      <div className="font-medium">{q.title}</div>
                      {q.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 max-w-[36rem]">
                          {q.description}
                        </div>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center align-middle">
                      <div>{fmtKST(q.start_at)} ~</div>
                      <div>{fmtKST(q.end_at)}</div>
                    </td>
                    <td className="p-2 text-center align-middle">
                      {statusBadge(st)}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center align-middle">
                      {fmtTimeLimit(q.time_limit_sec)}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center align-middle">
                      {modeLabel(q.assignment_mode)}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center align-middle">
                      {problemInfo(q)}
                    </td>
                    <td className="p-2 text-center align-middle whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {/* Placeholder routes; adjust if you add detail/edit pages */}
                        <Link
                          href={`/organization/${organizationId}/quizzes/${q.id}`}
                          className="rounded-md border px-2 py-1"
                        >
                          상세
                        </Link>
                        <Link
                          href={`/organization/${organizationId}/quizzes/${q.id}/edit`}
                          className="rounded-md border px-2 py-1"
                        >
                          편집
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
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

function statusLabel(s: "all" | "upcoming" | "active" | "ended") {
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
      ? "border-green-600 text-green-700"
      : s === "upcoming"
        ? "border-amber-600 text-amber-700"
        : "border-rose-600 text-rose-700";
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
  if (m === "one_for_all" || m === "all") return "전체 동일 1문제";
  return "응시마다 랜덤 1문제";
}

function problemInfo(q: QuizRow) {
  if (q.assignment_mode === "one_for_all" || q.assignment_mode === "all") {
    return q.global_problem_id ? `문제 #${q.global_problem_id}` : "문제 1개";
  }
  return "지정 풀에서 무작위";
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
