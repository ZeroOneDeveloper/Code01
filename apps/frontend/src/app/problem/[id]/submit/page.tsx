import React from "react";

import { createClient } from "@lib/supabase/server";
import ProblemSubmitForm from "@components/hero/ProblemSubmitForm";

const isNumeric = (value: string) => /^\d+$/.test(value);

const ProblemSubmitPage: React.FC<{
  params: Promise<{ id: string }>;
}> = async ({ params }) => {
  const supabase = await createClient();

  const { id } = await params;

  const { data } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNumeric(id) ? parseInt(id, 10) : id)
    .maybeSingle();

  const userId = (await supabase.auth.getUser()).data.user!.id;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold">{data.title}</h1>

        <hr className="border-[0.5] border-gray-200 dark:border-gray-700" />
      </div>

      <ProblemSubmitForm
        userId={userId}
        problemId={id}
        defaultCode={data.default_code}
      />
    </div>
  );
};

export default ProblemSubmitPage;
