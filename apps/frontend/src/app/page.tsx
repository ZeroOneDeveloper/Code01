import React from "react";
import { cookies } from "next/headers";

import { Problem } from "@lib/types";
import MainProblemSections from "@components/MainProblemSections";

type ProblemStats = {
  solved: number;
  submitted: number;
  accuracy: number;
};

type VisibleProblem = Problem & {
  uploader_name: string;
  stats: ProblemStats;
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
  upcoming_quizzes: UpcomingQuiz[];
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
    upcoming_quizzes: Array.isArray(payload?.upcoming_quizzes)
      ? (payload?.upcoming_quizzes as UpcomingQuiz[])
      : [],
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
        <MainProblemSections
          upcomingQuizzes={result.upcoming_quizzes}
          sections={sections}
          authenticated={result.viewer.authenticated}
        />
      </div>
    </div>
  );
}
