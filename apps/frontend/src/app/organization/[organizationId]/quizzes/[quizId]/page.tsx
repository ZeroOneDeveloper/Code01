"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { createClient } from "@lib/supabase/client";

type QuizRow = {
  id: string;
  organization_id: number;
  title: string;
  description: string | null;
  assignment_mode?: "one_for_all" | "one_per_attempt" | "all" | string;
  problem_count?: number | null;
  global_problem_id?: number | null;
  time_limit_sec: number;
  start_at: string;
  end_at: string;
  created_by?: string;
  created_at?: string;
};

type QuizProblemRow = { problem_id: number; order_index: number };

type ProblemRow = { id: number; title: string };

export default function QuizDetailPage() {
  const { organizationId, quizId } = useParams<{
    organizationId: string;
    quizId: string;
  }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [quizProblems, setQuizProblems] = useState<QuizProblemRow[]>([]);
  const [problemTitles, setProblemTitles] = useState<Record<number, string>>(
    {},
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!organizationId || !quizId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const orgId = Number(organizationId);
        const quizIdFilter = isUUID(quizId) ? quizId : Number(quizId);
        const { data: q, error } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", quizIdFilter)
          .eq("organization_id", orgId)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast.error(`퀴즈 조회 중 오류: ${error.message}`);
          setQuiz(null);
          return;
        }
        if (!q) {
          toast.info("존재하지 않거나 접근 권한이 없는 퀴즈입니다.");
          setQuiz(null);
          return;
        }
        setQuiz(q as QuizRow);

        // Load selected/pool problems for every mode.
        const { data: qp } = await supabase
          .from("quiz_problems")
          .select("problem_id, order_index")
          .eq("quiz_id", quizIdFilter)
          .order("order_index", { ascending: true });

        let problemRows = (qp || []) as QuizProblemRow[];
        if (problemRows.length === 0 && q.global_problem_id) {
          // Backward compatibility for old one_for_all quizzes.
          problemRows = [{ problem_id: q.global_problem_id, order_index: 0 }];
        }

        const ids = problemRows.map((x) => x.problem_id);
        if (ids.length) {
          const { data: plist } = await supabase
            .from("problems")
            .select("id, title")
            .in("id", ids);
          const map = Object.fromEntries(
            (plist || []).map((p: ProblemRow) => [p.id, p.title]),
          );
          setProblemTitles(map);
        } else {
          setProblemTitles({});
        }
        setQuizProblems(problemRows);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [organizationId, quizId, supabase]);

  const status = useMemo(() => (quiz ? statusOf(quiz) : null), [quiz]);

  const handleDeleteQuiz = async () => {
    if (!quiz || deleting || !organizationId) return;
    const ok = window.confirm(
      `퀴즈 "${quiz.title}"을(를) 삭제할까요?\n삭제 후 복구할 수 없습니다.`,
    );
    if (!ok) return;

    setDeleting(true);
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

      toast.success("퀴즈를 삭제했습니다.");
      router.replace(`/organization/${organizationId}/quizzes`);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="p-4 text-sm text-center">불러오는 중…</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4 text-center">
        <div className="text-sm">퀴즈를 찾을 수 없습니다.</div>
        <Link
          href={`/organization/${organizationId}/quizzes`}
          className="underline underline-offset-4 text-sm"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {quiz.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {status && statusBadge(status)}
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border">
              제한시간 {fmtTimeLimit(quiz.time_limit_sec)}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border">
              {modeLabel(quiz.assignment_mode)}
            </span>
            {quiz.assignment_mode === "one_per_attempt" &&
              typeof quiz.problem_count === "number" &&
              quiz.problem_count > 0 && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border">
                  n = {quiz.problem_count}
                </span>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/organization/${organizationId}/quizzes`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            목록
          </Link>
          <Link
            href={`/organization/${organizationId}/quizzes/${quiz.id}/edit`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            편집
          </Link>
          <button
            type="button"
            onClick={() => void handleDeleteQuiz()}
            disabled={deleting}
            className={`rounded-md border px-3 py-2 text-sm ${
              deleting
                ? "cursor-not-allowed border-rose-900 text-rose-900/70"
                : "border-rose-600/60 text-rose-300 hover:bg-rose-500/15"
            }`}
          >
            {deleting ? "삭제 중" : "삭제"}
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-md border p-4">
        <h2 className="text-sm font-semibold mb-2">기간</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">시작</div>
            <div className="text-sm">{fmtKST(quiz.start_at)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">마감</div>
            <div className="text-sm">{fmtKST(quiz.end_at)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">상태</div>
            <div>{status && statusBadge(status)}</div>
          </div>
        </div>
      </div>

      {/* Problems */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">문제</h2>
          {quiz.assignment_mode === "one_per_attempt" && (
            <div className="text-xs text-muted-foreground">
              응시마다 선택된 풀에서 무작위로 {quiz.problem_count ?? 1}개가
              배정됩니다.
            </div>
          )}
          {quiz.assignment_mode === "all" && (
            <div className="text-xs text-muted-foreground">
              선택된 모든 문제가 포함된 기존 모드 퀴즈입니다.
            </div>
          )}
          {quiz.assignment_mode === "one_for_all" && (
            <div className="text-xs text-muted-foreground">
              모든 응시자에게 선택한 문제 전체({quiz.problem_count ?? 0}개)가
              동일하게 배정됩니다.
            </div>
          )}
        </div>

        <div className="rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-medium">
            선택된 문제 ({quizProblems.length})
          </div>
          <div className="max-h-[420px] overflow-auto divide-y">
            {quizProblems.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                등록된 문제가 없습니다.
              </div>
            ) : (
              quizProblems.map((row, idx) => (
                <div
                  key={`${row.problem_id}-${idx}`}
                  className="flex items-start gap-3 p-3"
                >
                  <span className="text-xs rounded-full border px-2 py-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      #{row.problem_id}{" "}
                      {problemTitles[row.problem_id]
                        ? `— ${problemTitles[row.problem_id]}`
                        : ""}
                    </div>
                  </div>
                  <Link
                    href={`/problem/${row.problem_id}`}
                    className="rounded-md border px-2 py-1 text-xs"
                  >
                    문제 보기
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
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
  if (m === "one_for_all") return "전체 동일(전체 선택)";
  if (m === "all") return "전체 풀이(기존)";
  return "응시마다 무작위";
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

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}
