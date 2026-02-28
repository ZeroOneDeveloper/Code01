"use client";

import React, { useEffect, useRef, useState } from "react";
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

function formatRemain(diffMs: number): string {
  if (diffMs <= 0) return "입장 가능";
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}시간 ${m}분 ${s}초`;
}

export default function QuizWaitPage() {
  const { organizationId, quizId } = useParams<{
    organizationId: string;
    quizId: string;
  }>();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizEntryQuiz | null>(null);
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
              `/login?next=${encodeURIComponent(`/quiz/${organizationId}/${quizId}/wait`)}`,
            );
            return;
          }
          setError(result.message);
          return;
        }

        const fetchedQuiz = result.data.quiz;
        setQuiz(fetchedQuiz);

        if (result.data.status === "active") {
          redirectedRef.current = true;
          router.replace(`/quiz/${organizationId}/${quizId}`);
          return;
        }

        const serverNowMs = toMs(result.data.server_now);
        if (serverNowMs !== null) {
          setNowMs(serverNowMs);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [organizationId, quizId, router]);

  const startMs = toMs(quiz?.start_at);
  const endMs = toMs(quiz?.end_at);
  const canEnter =
    startMs !== null &&
    nowMs >= startMs &&
    (endMs === null || nowMs <= endMs);
  const ended = endMs !== null && nowMs > endMs;

  useEffect(() => {
    if (!quiz || !canEnter || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(`/quiz/${organizationId}/${quizId}`);
  }, [canEnter, organizationId, quiz, quizId, router]);

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-gray-700 bg-[#181b24] p-6 text-center text-gray-300">
          퀴즈 정보를 불러오는 중...
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-10 space-y-4">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-rose-300">
          {error || "퀴즈를 찾을 수 없습니다."}
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
    <div className="w-full max-w-3xl mx-auto px-4 py-10 space-y-4">
      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{quiz.title}</h1>
          {quiz.description && (
            <p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap">
              {quiz.description}
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">시작 시간</p>
            <p className="text-sm text-gray-100">{formatKST(quiz.start_at)}</p>
          </div>
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">마감 시간</p>
            <p className="text-sm text-gray-100">{formatKST(quiz.end_at)}</p>
          </div>
        </div>

        {ended ? (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            이 퀴즈는 이미 종료되었습니다.
          </div>
        ) : (
          <div className="rounded-md border border-teal-500/40 bg-teal-500/10 px-4 py-3">
            <p className="text-xs text-teal-300">입장까지 남은 시간</p>
            <p className="mt-1 text-lg font-semibold text-teal-200">
              {startMs === null
                ? "시작 시간이 설정되지 않았습니다."
                : formatRemain(startMs - nowMs)}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
          >
            홈으로
          </Link>
          <button
            type="button"
            onClick={() => router.push(`/quiz/${organizationId}/${quizId}`)}
            disabled={!canEnter || ended}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              canEnter && !ended
                ? "border border-teal-500/60 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
                : "cursor-not-allowed border border-gray-700 bg-gray-800 text-gray-500"
            }`}
          >
            {ended ? "종료됨" : canEnter ? "입장하기" : "대기 중"}
          </button>
        </div>
      </section>
    </div>
  );
}
