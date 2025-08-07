import React from "react";

import { createClient } from "@lib/supabase/server";
import ProblemCard from "@components/ProblemCard";

export default async function Home() {
  const supabase = await createClient();
  const { user } = (await supabase.auth.getUser()).data;

  if (user) {
    const { data: problems } = await supabase
      .from("problems")
      .select(
        "*, organizations(id, name, is_private, organization_members(user_id))",
      )
      .order("created_at", { ascending: false });

    const visibleProblems = (problems || []).filter((problem) => {
      const org = problem.organizations;
      if (!org) return true;
      if (!org.is_private) return true;
      return org.organization_members?.some(
        (m: { user_id: string }) => m.user_id === user.id,
      );
    });

    const grouped = visibleProblems.reduce((acc: any, p: any) => {
      const key = p.organizations?.id || "public";
      if (!acc[key]) {
        acc[key] = {
          name: p.organizations?.name || "공개 문제",
          problems: [],
        };
      }
      acc[key].problems.push(p);
      return acc;
    }, {});

    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-44">
        {Object.entries(grouped).map(([orgId, group]: any) => (
          <div key={orgId}>
            <h2 className="text-2xl font-bold mb-4">{group.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {group.problems.map((problem: any) => (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  href={`/problem/${problem.id}`}
                />
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
