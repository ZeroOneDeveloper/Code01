import React from "react";

import { Problem } from "@lib/types";
import { createClient } from "@lib/supabase/server";
import ProblemCard from "@components/ProblemCard";

export default async function Home() {
  const supabase = await createClient();
  const { user } = (await supabase.auth.getUser()).data;

  if (user) {
    // Fetch all problems
    const { data: problems } = await supabase
      .from("problems")
      .select("*")
      .order("created_at", { ascending: false });

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
            <h2 className="text-2xl font-bold mb-4">{group.name}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(24rem,24rem))] justify-start gap-6">
              {group.problems.map((problem) => (
                <div key={problem.id} className="w-[24rem]">
                  <ProblemCard
                    problem={problem}
                    href={`/problem/${problem.id}`}
                  />
                </div>
              ))}
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
