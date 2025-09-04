import React from "react";

import Link from "next/link";

import { Problem } from "@lib/types";
import ProblemCard from "@components/ProblemCard";
import { createClient } from "@lib/supabase/server";

const ProblemsPage: React.FC<{
  params: Promise<{ organizationId: string }>;
}> = async ({ params }) => {
  const supabase = await createClient();

  const { organizationId } = await params;

  const { data: problems, error } = await supabase
    .from("problems")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("문제 목록을 불러오는 중 오류 발생:", error);
    return (
      <div className="text-red-500">문제 목록을 불러오는 데 실패했습니다.</div>
    );
  }

  if (!problems) {
    return <div className="text-gray-500">문제 목록을 불러오는 중...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">문제 목록</h1>
        <Link
          href={`/organization/${organizationId}/problems/new`}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          새 문제 만들기
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {problems.map((problem: Problem) => (
          <ProblemCard
            key={problem.id}
            problem={problem}
            href={`/organization/${organizationId}/problems/new?id=${problem.id}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProblemsPage;
