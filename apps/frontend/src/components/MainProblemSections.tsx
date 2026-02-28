"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Lock,
  Search,
} from "lucide-react";

import { Problem, toGradeKo } from "@lib/types";

type ProblemStats = {
  solved: number;
  submitted: number;
  accuracy: number;
};

type VisibleProblem = Problem & {
  uploader_name: string;
  stats: ProblemStats;
};

type ProblemSection = {
  key: string;
  organization_id: number | null;
  organization_name: string;
  is_private: boolean;
  is_member: boolean;
  problems: VisibleProblem[];
};

type UpcomingQuiz = {
  id: number;
  organization_id: number;
  organization_name: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  time_limit_sec: number | null;
  assignment_mode: string | null;
  problem_count: number | null;
  status?: "upcoming" | "active" | string;
};

type SortKey = "id" | "title" | "source" | "uploader";
type SortDir = "asc" | "desc";

type Props = {
  upcomingQuizzes: UpcomingQuiz[];
  sections: ProblemSection[];
  authenticated: boolean;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

function sortProblems(
  problems: VisibleProblem[],
  sortKey: SortKey,
  sortDir: SortDir,
) {
  const sorted = [...problems].sort((a, b) => {
    if (sortKey === "id") {
      return a.id - b.id;
    }

    const av =
      sortKey === "title"
        ? a.title
        : sortKey === "source"
          ? a.source ?? ""
          : a.uploader_name ?? "";
    const bv =
      sortKey === "title"
        ? b.title
        : sortKey === "source"
          ? b.source ?? ""
          : b.uploader_name ?? "";

    return av.localeCompare(bv, "ko-KR", {
      sensitivity: "base",
      numeric: true,
    });
  });

  if (sortDir === "desc") {
    sorted.reverse();
  }
  return sorted;
}

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};

const formatAssignment = (quiz: UpcomingQuiz) => {
  if (quiz.assignment_mode === "one_per_attempt") {
    return typeof quiz.problem_count === "number" && quiz.problem_count > 0
      ? `응시마다 무작위 ${quiz.problem_count}개`
      : "응시마다 무작위 배정";
  }
  return "선택한 문제 전체(전원 동일)";
};

export default function MainProblemSections({
  upcomingQuizzes,
  sections,
  authenticated,
}: Props) {
  const [search, setSearch] = useState("");
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const onToggle = () => {
      setIsSearchMenuOpen((prev) => !prev);
    };
    window.addEventListener("home-search-toggle", onToggle);
    return () => window.removeEventListener("home-search-toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!isSearchMenuOpen) return;
    searchInputRef.current?.focus();
  }, [isSearchMenuOpen]);

  const filteredSections = useMemo(() => {
    const q = normalizeText(search);
    return sections
      .map((section) => {
        const filtered = section.problems.filter((problem) => {
          if (!q) return true;
          const haystack = [
            problem.title,
            problem.source ?? "",
            problem.uploader_name ?? "",
            String(problem.id),
          ]
            .map((part) => normalizeText(part))
            .join(" ");
          return haystack.includes(q);
        });

        return {
          ...section,
          problems: sortProblems(filtered, sortKey, sortDir),
        };
      })
      .filter((section) => section.problems.length > 0);
  }, [sections, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  const scheduledQuizzes = useMemo(() => {
    return [...upcomingQuizzes].sort((a, b) => {
      const aPriority = a.status === "active" ? 0 : 1;
      const bPriority = b.status === "active" ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aStart = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });
  }, [upcomingQuizzes]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {authenticated && scheduledQuizzes.length > 0 && (
        <section className="rounded-lg border border-teal-200/70 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">진행/예정 퀴즈</h3>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {scheduledQuizzes.length}개
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {scheduledQuizzes.map((quiz) => {
              const quizHref =
                quiz.status === "active"
                  ? `/quiz/${quiz.organization_id}/${quiz.id}`
                  : `/quiz/${quiz.organization_id}/${quiz.id}/wait`;
              return (
              <Link
                key={`${quiz.organization_id}:${quiz.id}`}
                href={quizHref}
                className="min-w-[250px] flex-1 rounded-lg border border-gray-200/90 dark:border-gray-700 bg-white/90 dark:bg-gray-900 p-3 hover:border-teal-400/70 hover:bg-teal-500/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {quiz.organization_name}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                      quiz.status === "active"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-amber-500/50 bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {quiz.status === "active" ? "진행중" : "예정"}
                  </span>
                </div>
                <h4 className="mt-1 text-sm font-semibold line-clamp-1">
                  {quiz.title}
                </h4>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  시작: {formatDateTime(quiz.start_at)}
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  마감: {formatDateTime(quiz.end_at)}
                </p>
                <p className="mt-2 text-xs text-primary">{formatAssignment(quiz)}</p>
              </Link>
              );
            })}
          </div>
        </section>
      )}

      {sections.length > 0 ? (
        <>
          {isSearchMenuOpen && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="문제 제목, 출처, 업로더로 검색"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent pl-9 pr-3 py-2 text-sm"
                />
              </label>
            </div>
          )}

          {filteredSections.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 px-6 py-10 text-center text-gray-500 dark:text-gray-300">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="space-y-8">
              {filteredSections.map((section) => (
                <section key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">
                        {section.organization_name}
                      </h3>
                      {section.organization_id !== null && section.is_private && (
                        <Lock
                          className="h-4 w-4 text-gray-500 dark:text-gray-300"
                          aria-label="비공개 조직"
                        />
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {section.problems.length}문제
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table-fixed w-full border border-gray-200 bg-white dark:bg-gray-900 rounded-lg">
                      <colgroup>
                        <col className="w-16" />
                        <col className="w-64" />
                        <col className="w-32" />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-24" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                            <button
                              type="button"
                              onClick={() => toggleSort("id")}
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              문제
                              {sortIcon("id")}
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                            <button
                              type="button"
                              onClick={() => toggleSort("title")}
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              문제 제목
                              {sortIcon("title")}
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                            <button
                              type="button"
                              onClick={() => toggleSort("source")}
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              출처
                              {sortIcon("source")}
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                            <button
                              type="button"
                              onClick={() => toggleSort("uploader")}
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              업로더
                              {sortIcon("uploader")}
                            </button>
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                            등급
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200 border-b">
                            맞힌 사람
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200 border-b">
                            제출
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200 border-b">
                            정답 비율
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.problems.map((problem) => (
                          <tr
                            key={problem.id}
                            className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                          >
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                              {problem.id}
                            </td>
                            <td className="px-4 py-2">
                              <Link
                                href={`/problem/${problem.id}`}
                                className="text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {problem.title}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              {problem.source || "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              {problem.uploader_name || "-"}
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              {toGradeKo(problem.grade)}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                              {problem.stats?.solved ?? 0}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                              {problem.stats?.submitted ?? 0}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                              {typeof problem.stats?.accuracy === "number"
                                ? `${problem.stats.accuracy.toFixed(1)}%`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 px-6 py-10 text-center text-gray-500 dark:text-gray-300">
          {authenticated ? "표시할 문제가 없습니다." : "현재 공개된 문제가 없습니다."}
        </div>
      )}
    </div>
  );
}
