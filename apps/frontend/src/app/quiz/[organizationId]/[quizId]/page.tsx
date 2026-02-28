"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { fetchQuizEntryContext, QuizEntryQuiz } from "@lib/quiz-entry";

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatKST(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function shuffle<T>(items: T[]): T[] {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function formatRemain(diffMs: number): string {
  if (diffMs <= 0) return "종료됨";
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}시간 ${m}분 ${s}초`;
}

export default function QuizTakePage() {
  const { organizationId, quizId } = useParams<{
    organizationId: string;
    quizId: string;
  }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizEntryQuiz | null>(null);
  const [assignedProblemIds, setAssignedProblemIds] = useState<number[]>([]);
  const [problemTitles, setProblemTitles] = useState<Record<number, string>>({});
  const [submissionSummaryByProblem, setSubmissionSummaryByProblem] = useState<
    Record<
      number,
      {
        submitted: boolean;
        submission_count: number;
        latest_status_code: number | null;
        latest_is_correct: boolean | null;
        latest_submitted_at: string | null;
      }
    >
  >({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!organizationId || !quizId) {
        setError("잘못된 퀴즈 경로입니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await fetchQuizEntryContext(organizationId, quizId);
        if (!result.ok) {
          if (result.status === 401) {
            router.replace(
              `/login?next=${encodeURIComponent(`/quiz/${organizationId}/${quizId}`)}`,
            );
            return;
          }
          setError(result.message);
          return;
        }

        const {
          quiz: fetchedQuiz,
          pool,
          status,
          server_now,
          viewer_user_id,
          submission_summary_by_problem,
        } = result.data;
        setQuiz(fetchedQuiz);

        const serverNowMs = toMs(server_now);
        const now = serverNowMs ?? Date.now();
        if (serverNowMs !== null) {
          setNowMs(serverNowMs);
        }

        if (status === "upcoming") {
          router.replace(`/quiz/${organizationId}/${quizId}/wait`);
          return;
        }
        if (status === "ended") {
          setError("이 퀴즈는 이미 종료되었습니다.");
          return;
        }

        const startMs = toMs(fetchedQuiz.start_at);
        const endMs = toMs(fetchedQuiz.end_at);
        if (startMs !== null && now < startMs) {
          router.replace(`/quiz/${organizationId}/${quizId}/wait`);
          return;
        }
        if (endMs !== null && now > endMs) {
          setError("이 퀴즈는 이미 종료되었습니다.");
          return;
        }

        const poolIds = Array.from(
          new Set(
            pool
              .map((item) => item.problem_id)
              .filter((id) => typeof id === "number" && Number.isFinite(id)),
          ),
        );

        if (poolIds.length === 0) {
          setError("이 퀴즈에는 배정된 문제가 없습니다.");
          return;
        }

        let assignedIds = poolIds;
        const assignmentKey = `quiz-assignment:${fetchedQuiz.id}:${viewer_user_id}`;
        if (fetchedQuiz.assignment_mode === "one_per_attempt") {
          const wanted =
            typeof fetchedQuiz.problem_count === "number" && fetchedQuiz.problem_count > 0
              ? Math.floor(fetchedQuiz.problem_count)
              : 1;
          const n = Math.max(1, Math.min(wanted, poolIds.length));

          let cached: number[] | null = null;
          try {
            const raw = window.localStorage.getItem(assignmentKey);
            if (raw) {
              const parsed = JSON.parse(raw) as number[];
              if (
                Array.isArray(parsed) &&
                parsed.length === n &&
                parsed.every((id) => poolIds.includes(id))
              ) {
                cached = parsed;
              }
            }
          } catch {
            cached = null;
          }

          if (!cached) {
            cached = shuffle(poolIds).slice(0, n);
            window.localStorage.setItem(assignmentKey, JSON.stringify(cached));
          }
          assignedIds = cached;
        }

        try {
          window.localStorage.setItem(assignmentKey, JSON.stringify(assignedIds));
        } catch {
          // ignore localStorage failures
        }

        const titleMap = Object.fromEntries(
          pool
            .filter((item) => typeof item.problem_id === "number")
            .map((item) => [item.problem_id, item.title ?? `문제 #${item.problem_id}`]),
        );

        setAssignedProblemIds(assignedIds);
        setProblemTitles(titleMap);
        const rawSummary = submission_summary_by_problem ?? {};
        const normalizedSummary = Object.fromEntries(
          Object.entries(rawSummary)
            .map(([problemId, summary]) => [Number(problemId), summary])
            .filter(([problemId]) => Number.isFinite(problemId)),
        ) as Record<
          number,
          {
            submitted: boolean;
            submission_count: number;
            latest_status_code: number | null;
            latest_is_correct: boolean | null;
            latest_submitted_at: string | null;
          }
        >;
        setSubmissionSummaryByProblem(normalizedSummary);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [organizationId, quizId, router]);

  const endMs = toMs(quiz?.end_at);
  const ended = endMs !== null && nowMs > endMs;

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-gray-700 bg-[#181b24] p-6 text-center text-gray-300">
          퀴즈 입장 정보를 불러오는 중...
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-10 space-y-4">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-rose-300">
          {error || "퀴즈에 입장할 수 없습니다."}
        </div>
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-300 underline">
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10 space-y-4">
      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-6 space-y-3">
        <h1 className="text-2xl font-bold text-gray-100">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-sm text-gray-400 whitespace-pre-wrap">
            {quiz.description}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">시작</p>
            <p className="text-sm text-gray-100">{formatKST(quiz.start_at)}</p>
          </div>
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">마감</p>
            <p className="text-sm text-gray-100">{formatKST(quiz.end_at)}</p>
          </div>
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">남은 시간</p>
            <p className="text-sm text-gray-100">
              {endMs === null ? "-" : formatRemain(endMs - nowMs)}
            </p>
          </div>
        </div>
        {ended && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            마감 시간이 지나 제출이 제한될 수 있습니다.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">배정된 문제</h2>
          <span className="text-sm text-gray-400">{assignedProblemIds.length}문제</span>
        </div>

        <div className="mt-3 space-y-2">
          {assignedProblemIds.length === 0 ? (
            <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-3 text-sm text-gray-400">
              배정된 문제가 없습니다.
            </div>
          ) : (
            assignedProblemIds.map((problemId, idx) => {
              const nextProblemId =
                idx < assignedProblemIds.length - 1
                  ? assignedProblemIds[idx + 1]
                  : null;
              const submitHref = nextProblemId
                ? `/problem/${problemId}/submit?quizId=${quiz.id}&nextProblemId=${nextProblemId}`
                : `/problem/${problemId}/submit?quizId=${quiz.id}`;
              return (
                <div
                  key={`${problemId}-${idx}`}
                  className="rounded-md border border-gray-700 bg-[#121723] px-3 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-100">
                      {idx + 1}. #{problemId}{" "}
                      {problemTitles[problemId] ? `- ${problemTitles[problemId]}` : ""}
                    </p>
                    {(() => {
                      const summary = submissionSummaryByProblem[problemId];
                      const submitted = summary?.submitted ?? false;
                      const submittedAtLabel = summary?.latest_submitted_at
                        ? new Date(summary.latest_submitted_at).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })
                        : null;
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                              submitted
                                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                                : "border-gray-600 bg-gray-700/30 text-gray-300"
                            }`}
                          >
                            {submitted ? "제출 완료" : "미제출"}
                          </span>
                          {submitted && (
                            <span className="text-gray-400">
                              {summary?.submission_count ?? 0}회 제출
                            </span>
                          )}
                          {submittedAtLabel && (
                            <span className="text-gray-500">최근: {submittedAtLabel}</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <Link
                    href={submitHref}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      ended
                        ? "cursor-not-allowed border border-gray-700 bg-gray-800 text-gray-500 pointer-events-none"
                        : "border border-teal-500/60 bg-teal-500/15 text-teal-100 hover:bg-teal-500/25"
                    }`}
                  >
                    제출 페이지
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
