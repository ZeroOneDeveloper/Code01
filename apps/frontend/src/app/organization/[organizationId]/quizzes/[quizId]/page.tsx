"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { createClient } from "@lib/supabase/client";

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
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [quizProblems, setQuizProblems] = useState<QuizProblemRow[]>([]);
  const [problemTitles, setProblemTitles] = useState<Record<number, string>>(
    {},
  );

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

        // Load problem(s)
        if (
          q.assignment_mode === "one_for_all" ||
          q.assignment_mode === "all"
        ) {
          if (q.global_problem_id) {
            const { data: p } = await supabase
              .from("problems")
              .select("id, title")
              .eq("id", q.global_problem_id)
              .single();
            if (p) setProblemTitles({ [p.id]: p.title });
          }
          setQuizProblems([]);
        } else {
          const { data: qp } = await supabase
            .from("quiz_problems")
            .select("problem_id, order_index")
            .eq("quiz_id", quizId)
            .order("order_index", { ascending: true });

          console.log(qp);

          const ids = (qp || []).map((x) => x.problem_id);
          if (ids.length) {
            const { data: plist } = await supabase
              .from("problems")
              .select("id, title")
              .in("id", ids);
            const map = Object.fromEntries(
              (plist || []).map((p: ProblemRow) => [p.id, p.title]),
            );
            setProblemTitles(map);
          }
          setQuizProblems((qp || []) as QuizProblemRow[]);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [organizationId, quizId, supabase]);

  const status = useMemo(() => (quiz ? statusOf(quiz) : null), [quiz]);

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
              응시마다 선택된 풀에서 무작위 1문제가 배정됩니다.
            </div>
          )}
        </div>

        {quiz.assignment_mode === "one_for_all" ||
        quiz.assignment_mode === "all" ? (
          quiz.global_problem_id ? (
            <div className="rounded-md border divide-y">
              <div className="flex items-center justify-between p-3">
                <div className="text-sm font-medium">
                  문제 #{quiz.global_problem_id}{" "}
                  {problemTitles[quiz.global_problem_id]
                    ? `— ${problemTitles[quiz.global_problem_id]}`
                    : ""}
                </div>
                <Link
                  href={`/organization/1/problems/new?id=${quiz.global_problem_id}`}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  문제 보기
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              지정된 문제가 없습니다.
            </div>
          )
        ) : (
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
                      href={`/organization/${organizationId}/problems/new?id=${row.problem_id}`}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      문제 보기
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
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
  if (m === "one_for_all" || m === "all") return "전체 동일 1문제";
  return "응시마다 랜덤 1문제";
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
