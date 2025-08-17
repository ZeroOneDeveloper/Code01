import React from "react";

import ProblemTabs from "@components/ProblemTabs";
import { createClient } from "@lib/supabase/server";

const NotFoundProblem: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">문제를 찾을 수 없습니다.</h1>
    </div>
  );
};

export default async function ProblemPageLayout({
  params,
  children,
}: Readonly<{
  params: Promise<{ problemId: string }>;
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const { problemId } = await params;

  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNaN(Number(problemId)) ? problemId : parseInt(problemId, 10))
    .maybeSingle();

  if (error || !data) {
    console.error(error);
    return <NotFoundProblem />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-44">
      <div className="flex flex-col gap-8 w-5/6 md:w-2/3 xl:w-1/2 mx-auto">
        <ProblemTabs />
        {children}
      </div>
    </div>
  );
}
