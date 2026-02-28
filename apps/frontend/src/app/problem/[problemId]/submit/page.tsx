import React from "react";

import { createClient } from "@lib/supabase/server";
import ProblemSubmitForm from "@components/hero/ProblemSubmitForm";
import { redirect } from "next/navigation";

const isNumeric = (value: string) => /^\d+$/.test(value);
const toSingleQuery = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const toMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

type QuizSubmitContext = {
  quizId: number;
  organizationId: number;
  endAt: string | null;
  timeLimitSec: number | null;
  attemptStartedAt: string | null;
  nextProblemId: number | null;
};

const ProblemSubmitPage: React.FC<{
  params: Promise<{ problemId: string }>;
  searchParams: Promise<{
    quizId?: string | string[];
    nextProblemId?: string | string[];
  }>;
}> = async ({ params, searchParams }) => {
  const supabase = await createClient();

  const { problemId } = await params;
  const resolvedSearchParams = await searchParams;
  const quizIdRaw = toSingleQuery(resolvedSearchParams?.quizId);
  const nextProblemIdRaw = toSingleQuery(resolvedSearchParams?.nextProblemId);
  const problemIdNumber = isNumeric(problemId) ? parseInt(problemId, 10) : NaN;

  const { data } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNumeric(problemId) ? problemIdNumber : problemId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const userId = user.id;

  if (!data) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-4xl font-bold">문제를 찾을 수 없습니다.</h1>
          <hr className="mt-4 border-[0.5] border-gray-200 dark:border-gray-700" />
        </div>
      </div>
    );
  }

  const deadline = (data?.deadline as string | null) ?? null;
  const isPastProblemDeadline =
    !!deadline &&
    !Number.isNaN(new Date(deadline).getTime()) &&
    new Date(deadline).getTime() < Date.now();
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;
  let quizAccessMessage: string | null = null;
  let quizAccessTimeLabel: string | null = null;
  let quizBlockSubmission = false;
  let quizSubmitContext: QuizSubmitContext | null = null;

  if (quizIdRaw && isNumeric(quizIdRaw) && Number.isFinite(problemIdNumber)) {
    const quizId = parseInt(quizIdRaw, 10);
    const { data: quiz } = await supabase
      .from("quizzes")
      .select(
        "id, organization_id, start_at, end_at, published_at, global_problem_id, time_limit_sec",
      )
      .eq("id", quizId)
      .maybeSingle();

    if (!quiz) {
      quizAccessMessage = "유효하지 않은 퀴즈 접근입니다.";
      quizBlockSubmission = true;
    } else {
      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("organization_id", quiz.organization_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!member) {
        quizAccessMessage = "이 퀴즈에 참여할 권한이 없습니다.";
        quizBlockSubmission = true;
      } else {
        const nowMs = Date.now();
        const publishedMs = toMs(quiz.published_at);
        const startMs = toMs(quiz.start_at);
        const quizEndMs = toMs(quiz.end_at);
        const parsedNextProblemId =
          nextProblemIdRaw &&
          isNumeric(nextProblemIdRaw) &&
          Number.isFinite(parseInt(nextProblemIdRaw, 10))
            ? parseInt(nextProblemIdRaw, 10)
            : null;
        let attemptStartedAt: string | null = null;

        const attemptQuery = await supabase
          .from("quiz_attempts")
          .select("started_at")
          .eq("quiz_id", quiz.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!attemptQuery.error && attemptQuery.data) {
          attemptStartedAt = (attemptQuery.data as { started_at?: string | null })
            .started_at ?? null;
        }

        quizSubmitContext = {
          quizId: quiz.id,
          organizationId: quiz.organization_id,
          endAt: quiz.end_at,
          timeLimitSec: quiz.time_limit_sec,
          attemptStartedAt,
          nextProblemId: parsedNextProblemId,
        };

        if (publishedMs !== null && nowMs < publishedMs) {
          quizAccessMessage = "아직 공개되지 않은 퀴즈입니다.";
          quizBlockSubmission = true;
        } else if (startMs !== null && nowMs < startMs) {
          quizAccessMessage = "퀴즈 시작 전에는 제출할 수 없습니다.";
          quizAccessTimeLabel = new Date(startMs).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          });
          quizBlockSubmission = true;
        } else if (!attemptStartedAt) {
          quizAccessMessage =
            "퀴즈 입장 시각 기준으로 시험 시간이 시작됩니다. 퀴즈 페이지에서 먼저 입장해 주세요.";
          quizBlockSubmission = true;
        } else {
          const attemptStartedMs = toMs(attemptStartedAt);
          const effectiveDeadlines: number[] = [];
          if (quizEndMs !== null) {
            effectiveDeadlines.push(quizEndMs);
          }
          if (
            attemptStartedMs !== null &&
            typeof quiz.time_limit_sec === "number" &&
            quiz.time_limit_sec > 0
          ) {
            effectiveDeadlines.push(attemptStartedMs + quiz.time_limit_sec * 1000);
          }
          const effectiveDeadlineMs =
            effectiveDeadlines.length > 0 ? Math.min(...effectiveDeadlines) : null;
          const isQuizWindowEnded =
            effectiveDeadlineMs !== null && nowMs >= effectiveDeadlineMs;

          if (isQuizWindowEnded) {
            quizAccessMessage =
              "퀴즈 제출 시간이 종료되어 더 이상 입장/제출할 수 없습니다.";
            quizAccessTimeLabel = new Date(effectiveDeadlineMs).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            });
            quizBlockSubmission = true;
          }
        }

        if (!quizBlockSubmission && attemptStartedAt) {
          const { data: mapped } = await supabase
            .from("quiz_problems")
            .select("problem_id")
            .eq("quiz_id", quiz.id)
            .eq("problem_id", problemIdNumber)
            .maybeSingle();

          const inQuizByLegacy =
            typeof quiz.global_problem_id === "number" &&
            quiz.global_problem_id === problemIdNumber;

          if (!mapped && !inQuizByLegacy) {
            quizAccessMessage =
              "이 문제는 해당 퀴즈의 배정 문제 목록에 포함되어 있지 않습니다.";
            quizBlockSubmission = true;
          }
        }

      }
    }
  }

  const isQuizMode = !!quizSubmitContext;
  const isSubmissionBlocked = isQuizMode
    ? quizBlockSubmission
    : isPastProblemDeadline || quizBlockSubmission;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold">{data?.title}</h1>

        {!isQuizMode && isPastProblemDeadline && (
          <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-700 dark:text-rose-200">
            이 문제는 <span className="font-semibold">마감</span>되었습니다. 더
            이상 제출할 수 없습니다.
            {deadlineLabel && (
              <div className="mt-1 text-xs opacity-80">
                마감: {deadlineLabel} (KST)
              </div>
            )}
          </div>
        )}

        {quizAccessMessage && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-200">
            {quizAccessMessage}
            {quizAccessTimeLabel && (
              <div className="mt-1 text-xs opacity-80">
                기준 시각: {quizAccessTimeLabel} (KST)
              </div>
            )}
          </div>
        )}

        <hr className="mt-4 border-[0.5] border-gray-200 dark:border-gray-700" />
      </div>

      {!isSubmissionBlocked && (
        <ProblemSubmitForm
          userId={userId}
          problemId={problemId}
          defaultCode={data.default_code ?? ""}
          availableLanguages={data.available_languages}
          quizSubmitContext={quizSubmitContext}
          forceAutoSubmit={false}
        />
      )}
    </div>
  );
};

export default ProblemSubmitPage;
