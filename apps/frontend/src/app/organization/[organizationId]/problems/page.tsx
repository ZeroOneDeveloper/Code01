import React from "react";
import Link from "next/link";

import { createClient } from "@lib/supabase/server";
import { Problem, toGradeKo } from "@lib/types";

const gradeBadgeClass = (grade: Problem["grade"]) => {
  if (grade === "expert") {
    return "border-rose-500/50 bg-rose-500/15 text-rose-300";
  }
  if (grade === "advanced") {
    return "border-orange-500/50 bg-orange-500/15 text-orange-300";
  }
  if (grade === "intermediate") {
    return "border-blue-500/50 bg-blue-500/15 text-blue-300";
  }
  return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};

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
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        문제 목록을 불러오는 데 실패했습니다.
      </div>
    );
  }

  const rows = (problems ?? []) as Problem[];
  const stats = {
    total: rows.length,
    beginner: rows.filter((p) => p.grade === "beginner").length,
    intermediate: rows.filter((p) => p.grade === "intermediate").length,
    advanced: rows.filter((p) => p.grade === "advanced").length,
    expert: rows.filter((p) => p.grade === "expert").length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 px-2 md:px-0">
      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">문제 목록</h1>
            <p className="mt-1 text-sm text-gray-400">
              조직 문제를 생성/수정하고 테스트 케이스를 관리합니다.
            </p>
          </div>
          <Link
            href={`/organization/${organizationId}/problems/new`}
            className="inline-flex items-center rounded-md border border-teal-500/60 bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25"
          >
            새 문제 만들기
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {[
            { label: "전체", value: stats.total },
            { label: "초급", value: stats.beginner },
            { label: "중급", value: stats.intermediate },
            { label: "상급", value: stats.advanced },
            { label: "최상급", value: stats.expert },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2"
            >
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-base font-semibold text-gray-100">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5">
        <div className="rounded-lg border border-gray-700 overflow-x-auto">
          <table className="w-full min-w-[930px] table-fixed text-sm">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="border-b border-gray-700 bg-[#222736]">
              <tr>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  번호
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-100">
                  제목
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  등급
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  시간
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  메모리
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-100">
                  게시/마감
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    등록된 문제가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((problem) => {
                  const due = problem.deadline
                    ? `마감 · ${formatDateTime(problem.deadline)}`
                    : "제한없음";
                  const published = `게시 · ${formatDateTime(problem.published_at)}`;

                  return (
                    <tr key={problem.id} className="hover:bg-[#202635]">
                      <td className="px-3 py-3 text-center text-gray-200">
                        {problem.id}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/problem/${problem.id}`}
                          className="line-clamp-1 font-medium text-gray-100 hover:text-teal-300"
                        >
                          {problem.title}
                        </Link>
                        <p className="mt-1 line-clamp-1 text-xs text-gray-400">
                          출처: {problem.source || "-"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${gradeBadgeClass(
                            problem.grade,
                          )}`}
                        >
                          {toGradeKo(problem.grade)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-200">
                        {problem.time_limit ? `${problem.time_limit} ms` : "-"}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-200">
                        {problem.memory_limit ? `${problem.memory_limit} MB` : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-300">
                        <p>{published}</p>
                        <p className="mt-1">{due}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/organization/${organizationId}/problems/new?id=${problem.id}`}
                            className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700/40"
                          >
                            수정
                          </Link>
                          <Link
                            href={`/organization/${organizationId}/problems/tests?id=${problem.id}`}
                            className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700/40"
                          >
                            테스트
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ProblemsPage;
