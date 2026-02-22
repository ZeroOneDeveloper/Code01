import React from "react";
import { cookies } from "next/headers";
import { Lock } from "lucide-react";

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

type VisibleProblemsResponse = {
  viewer: {
    authenticated: boolean;
    user_id: string | null;
  };
  total: number;
  sections: ProblemSection[];
};

const DEFAULT_API_BASE = "http://localhost:3001";

const normalizeResponse = (
  payload: Partial<VisibleProblemsResponse> | null,
): VisibleProblemsResponse => {
  const viewer = payload?.viewer ?? { authenticated: false, user_id: null };
  return {
    viewer: {
      authenticated: Boolean(viewer.authenticated),
      user_id: viewer.user_id ?? null,
    },
    total: typeof payload?.total === "number" ? payload.total : 0,
    sections: Array.isArray(payload?.sections)
      ? (payload?.sections as ProblemSection[])
      : [],
  };
};

const loadVisibleProblems = async (): Promise<VisibleProblemsResponse> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const apiBase =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_API_BASE;

  try {
    const response = await fetch(`${apiBase}/data/problems/visible`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return normalizeResponse(null);
    }

    const payload =
      (await response.json()) as Partial<VisibleProblemsResponse> | null;
    return normalizeResponse(payload);
  } catch {
    return normalizeResponse(null);
  }
};

export default async function Home() {
  const result = await loadVisibleProblems();
  const sections = result.sections.filter(
    (section) => Array.isArray(section.problems) && section.problems.length > 0,
  );

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">문제 목록</h2>
        </div>

        {sections.length === 0 ? (
          <div className="max-w-5xl mx-auto rounded-lg border border-gray-200 bg-white dark:bg-gray-900 px-6 py-10 text-center text-gray-500 dark:text-gray-300">
            {result.viewer.authenticated
              ? "표시할 문제가 없습니다."
              : "현재 공개된 문제가 없습니다."}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8">
            {sections.map((section) => (
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
                          문제
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                          문제 제목
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                          출처
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200 border-b">
                          업로더
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
                            <a
                              href={`/problem/${problem.id}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {problem.title}
                            </a>
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
      </div>
    </div>
  );
}
