import React from "react";

import CopyButton from "@components/CopyButton";
import { createClient } from "@lib/supabase/server";

const isNumeric = (value: string) => /^\d+$/.test(value);

const NotFoundProblem: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">문제를 찾을 수 없습니다.</h1>
    </div>
  );
};

const ProblemPage: React.FC<{
  params: Promise<{ problemId: string }>;
}> = async ({ params }) => {
  const supabase = await createClient();

  const { problemId } = await params;

  const { data } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNumeric(problemId) ? parseInt(problemId, 10) : problemId)
    .maybeSingle();

  const creator = await supabase
    .from("users")
    .select("name")
    .eq("id", data.created_by)
    .maybeSingle();

  if (creator.error || !creator.data) {
    console.log(creator.error);
    return <NotFoundProblem />;
  }

  data.creator = creator.data.name;

  const formatKoreanDate = (iso?: string | null) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const publishedNode = data.published_at ? (
    <span className="text-sky-400">{formatKoreanDate(data.published_at)}</span>
  ) : (
    "-"
  );

  const deadlineNode = data.deadline ? (
    (() => {
      const d = new Date(data.deadline as string);
      const now = new Date();
      const diffDays = Math.ceil(
        (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (d.getTime() < now.getTime()) {
        return (
          <span className="text-rose-400">
            {formatKoreanDate(data.deadline)} · 마감됨
          </span>
        );
      }
      return (
        <span className="text-rose-400">
          {formatKoreanDate(data.deadline)} · D-{diffDays}
        </span>
      );
    })()
  ) : (
    <span className="text-gray-400">제한없음</span>
  );

  const isPastDeadline = (() => {
    if (!data.deadline) return false;
    try {
      const d = new Date(data.deadline as string);
      return d.getTime() < Date.now();
    } catch {
      return false;
    }
  })();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 flex flex-col gap-8">
      <h1 className="text-4xl font-bold">{data.title}</h1>
      {isPastDeadline && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3">
          이 문제는 <span className="font-semibold">마감</span>되었습니다. 더
          이상 제출할 수 없습니다.
        </div>
      )}

      <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 text-center gap-2 md:gap-4">
        {[
          {
            label: "시간 제한",
            value:
              data.time_limit != null ? `${data.time_limit}초` : "제한없음",
          },
          {
            label: "메모리 제한",
            value:
              data.memory_limit != null ? `${data.memory_limit}MB` : "제한없음",
          },
          { label: "제출", value: data.submission_count ?? "-" },
          { label: "정답", value: data.correct_count ?? "-" },
          { label: "맞힌 사람", value: data.user_count ?? "-" },
          {
            label: "정답 비율",
            value: data.correct_rate != null ? `${data.correct_rate}%` : "-",
          },
          {
            label: "게시일",
            value: publishedNode,
          },
          {
            label: "마감",
            value: deadlineNode,
          },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`px-2 py-2 flex flex-col items-center justify-center border-b border-gray-700 ${idx >= 6 ? "col-span-2 sm:col-span-3 md:col-span-3" : ""}`}
          >
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {item.label}
            </div>
            <div className="text-base font-medium min-h-[28px] whitespace-nowrap">
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          설명
        </h2>
        <div>{data.description}</div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          조건
        </h2>
        <ul className="list-disc list-inside w-fit">
          {data.conditions
            ? data.conditions.map((condition: string, index: number) => (
                <li key={index} className="mb-2">
                  {condition}
                </li>
              ))
            : "조건이 없습니다."}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          입력
        </h2>
        <div>
          {data.input_description
            ? data.input_description
            : "입력 설명이 없습니다."}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          출력
        </h2>
        <div>{data.output_description}</div>
      </div>
      {data.sample_inputs.map((sample_input: string, index: number) => (
        <div
          key={index}
          className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8"
        >
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-4 border-b-2 border-primary w-fit">
              <h2 className="text-2xl font-semibold">예제 입력 {index + 1}</h2>
              <CopyButton text={sample_input} />
            </div>
            <pre className="bg-gray-800 text-white p-4 rounded-md whitespace-pre-wrap">
              {sample_input}
            </pre>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-4 border-b-2 border-primary w-fit">
              <h2 className="text-2xl font-semibold">예제 출력 {index + 1}</h2>
              <CopyButton text={sample_input} />
            </div>
            <pre className="bg-gray-800 text-white p-4 rounded-md whitespace-pre-wrap">
              {data.sample_outputs[index]}
            </pre>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          출처
        </h2>
        <ul className="list-disc list-inside w-fit">
          {[
            {
              key: "문제를 만든 사람",
              value: data.creator,
            },
          ].map(
            (
              data: {
                key: string;
                value: string;
              },
              index: number,
            ) => (
              <li key={index} className="mb-2">
                {data.key}: {data.value}
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
};

export default ProblemPage;
