import React from "react";

import { Problem } from "@lib/types";
import { createClient } from "@lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { user } = (await supabase.auth.getUser()).data;

  if (user) {
    // Fetch all problems
    const { data: problems } = await supabase
      .from("problems")
      .select("*")
      .order("created_at", { ascending: false });

    // Batch-fetch submission stats and user names
    const problemIds = problems?.map((p) => p.id) ?? [];

    const { data: submissions } = await supabase
      .from("problem_submissions")
      .select("problem_id, is_correct")
      .in("problem_id", problemIds);

    const { data: users } = await supabase.from("users").select("id, name");

    const userMap = Object.fromEntries(
      (users ?? []).map((u) => [u.id, u.name]),
    );
    const statsMap: Record<
      number,
      { solved: number; submitted: number; accuracy: number }
    > = {};

    for (const id of problemIds) {
      const related = submissions?.filter((s) => s.problem_id === id) ?? [];
      const submitted = related.length;
      const solved = related.filter((s) => s.is_correct).length;
      const accuracy = submitted ? (solved / submitted) * 100 : 0;
      statsMap[id] = { solved, submitted, accuracy };
    }

    // Cache for organizations to avoid duplicate queries
    const organizations: Record<
      string,
      { id: string; name: string; is_private: boolean }
    > = {};

    // Filter and group visible problems
    const visibleProblems: {
      [orgId: string]: { name: string; problems: Problem[] };
    } = {};

    if (problems) {
      for (const problem of problems) {
        if (problem.organization_id) {
          let org = organizations[String(problem.organization_id)];
          if (!org) {
            const { data: orgData } = await supabase
              .from("organizations")
              .select("id, name, is_private")
              .eq("id", problem.organization_id)
              .maybeSingle();
            if (!orgData) continue;
            org = orgData;
            organizations[String(org.id)] = org;
          }

          if (org.is_private) {
            const { count } = await supabase
              .from("organization_members")
              .select("*", { count: "exact", head: true })
              .eq("organization_id", org.id)
              .eq("user_id", user.id);
            if (!count) continue;
          }

          const key = String(org.id);
          if (!visibleProblems[key]) {
            visibleProblems[key] = { name: org.name, problems: [] };
          }
          visibleProblems[key].problems.push(problem);
        } else {
          const key = "public";
          if (!visibleProblems[key]) {
            visibleProblems[key] = { name: "공개 문제", problems: [] };
          }
          visibleProblems[key].problems.push(problem);
        }
      }
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-44 gap-8">
        {Object.entries(visibleProblems).map(([orgId, group]) => (
          <div key={orgId} className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">{group.name}</h2>
            </div>
            <div className="overflow-x-auto max-w-5xl mx-auto">
              <div className="max-w-5xl mx-auto">
                <table className="table-fixed w-full max-w-5xl border border-gray-200 bg-white dark:bg-gray-900 rounded-lg">
                  <colgroup>
                    <col className="w-16" />
                    <col className="w-64" />
                    <col className="w-64" />
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
                    {group.problems.map((problem) => (
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
                          {userMap[problem.created_by] ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {problem.grade ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                          {statsMap[problem.id]?.solved ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                          {statsMap[problem.id]?.submitted ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                          {typeof statsMap[problem.id]?.accuracy === "number"
                            ? `${statsMap[problem.id].accuracy.toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow flex flex-col">
        <div className="flex-1" />
        <div className="w-2/3 md:w-1/2 mx-auto">
          <h1 className="text-black dark:text-white font-black text-3xl md:text-4xl lg:text-6xl text-shadow-lg/50 text-shadow-black/50 dark:text-shadow-[#4f46e5]/50 text-left">
            Solve from 0 to 1.
          </h1>
          <h1 className="text-black dark:text-white font-black text-2xl md:text-3xl lg:text-4xl text-shadow-lg text-right">
            강릉원주대 컴공 온라인 저지
          </h1>
        </div>
        <div className="flex-1" />
      </main>
    </div>
  );
}
