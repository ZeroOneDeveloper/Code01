import React from "react";

import { createClient } from "@lib/supabase/server";
import ProblemSubmitForm from "@components/hero/ProblemSubmitForm";

const isNumeric = (value: string) => /^\d+$/.test(value);

const ProblemSubmitPage: React.FC<{
  params: Promise<{ problemId: string }>;
}> = async ({ params }) => {
  const supabase = await createClient();

  const { problemId } = await params;

  const { data } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNumeric(problemId) ? parseInt(problemId, 10) : problemId)
    .maybeSingle();

  const userId = (await supabase.auth.getUser()).data.user!.id;

  const deadline = (data?.deadline as string | null) ?? null;
  const isPastDeadline =
    !!deadline &&
    !Number.isNaN(new Date(deadline).getTime()) &&
    new Date(deadline).getTime() < Date.now();
  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold">{data.title}</h1>

        {isPastDeadline && (
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

        <hr className="mt-4 border-[0.5] border-gray-200 dark:border-gray-700" />
      </div>

      {!isPastDeadline && (
        <ProblemSubmitForm
          userId={userId}
          problemId={problemId}
          defaultCode={data.default_code}
          availableLanguages={data.available_languages}
        />
      )}
    </div>
  );
};

export default ProblemSubmitPage;
