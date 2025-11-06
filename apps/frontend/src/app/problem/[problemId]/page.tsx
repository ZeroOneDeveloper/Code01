import React from "react";
import Head from "next/head";

import { Tags as TagsIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import type { Problem } from "@lib/types";
import CopyButton from "@components/CopyButton";
import { createClient } from "@lib/supabase/server";

const isNumeric = (value: string) => /^\d+$/.test(value);

const normalizeMarkdown = (s?: string) =>
  (s ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(
      /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u202A-\u202E\u2066-\u2069]/g,
      "",
    );

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

  const { data: problemRaw, error: problemError } = await supabase
    .from("problems")
    .select("*")
    .eq("id", isNumeric(problemId) ? parseInt(problemId, 10) : problemId)
    .maybeSingle();

  const problem = problemRaw as Problem | null;

  if (problemError || !problem) {
    console.log(problemError);
    return <NotFoundProblem />;
  }

  const { data: creatorData } = await supabase
    .from("users")
    .select("name")
    .eq("id", problem.created_by)
    .maybeSingle();

  const creatorName = creatorData?.name ?? "-";

  const { data: submissionsData } = await supabase
    .from("problem_submissions")
    .select("user_id, passed_all")
    .eq("problem_id", problem.id);

  const submission_count = submissionsData?.length ?? 0;
  const correct_count =
    submissionsData?.filter((s) => s.passed_all)?.length ?? 0;
  const user_count = submissionsData
    ? new Set(submissionsData.filter((s) => s.passed_all).map((s) => s.user_id))
        .size
    : 0;
  const correct_rate =
    submission_count === 0
      ? "0%"
      : `${Math.floor((correct_count / submission_count) * 100)}%`;

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

  const publishedNode = problem.published_at ? (
    <span className="text-sky-400">
      {formatKoreanDate(problem.published_at)}
    </span>
  ) : (
    "-"
  );

  const deadlineNode = problem.deadline ? (
    (() => {
      const d = new Date(problem.deadline as string);
      const now = new Date();
      const diffDays = Math.ceil(
        (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (d.getTime() < now.getTime()) {
        return (
          <span className="text-rose-400">
            {formatKoreanDate(problem.deadline)} · 마감됨
          </span>
        );
      }
      return (
        <span className="text-rose-400">
          {formatKoreanDate(problem.deadline)} · D-{diffDays}
        </span>
      );
    })()
  ) : (
    <span className="text-gray-400">제한없음</span>
  );

  const isPastDeadline = (() => {
    if (!problem.deadline) return false;
    try {
      const d = new Date(problem.deadline as string);
      return d.getTime() < Date.now();
    } catch {
      return false;
    }
  })();

  return (
    <div className="mx-auto w-full px-4 flex flex-col gap-8">
      <Head>
        <style>{`
          /* hide MathML to avoid duplicated visible text */
          .katex .katex-mathml { display: none !important; }
        `}</style>
      </Head>
      <h1 className="text-4xl font-bold">{problem.title}</h1>
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
              problem.time_limit != null
                ? `${problem.time_limit / 1000}초`
                : "제한없음",
          },
          {
            label: "메모리 제한",
            value:
              problem.memory_limit != null
                ? `${problem.memory_limit}MB`
                : "제한없음",
          },
          { label: "제출", value: submission_count || "-" },
          { label: "정답", value: correct_count || "-" },
          { label: "맞힌 사람", value: user_count || "-" },
          {
            label: "정답 비율",
            value: correct_rate,
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
        <div className="prose prose-invert max-w-none break-words whitespace-pre-wrap">
          <ReactMarkdown
            remarkPlugins={[
              [remarkMath, { singleDollarTextMath: true }],
              remarkGfm,
            ]}
            rehypePlugins={[
              [rehypeKatex, { output: "html", strict: "ignore" }],
            ]}
          >
            {normalizeMarkdown(problem.description)}
          </ReactMarkdown>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          조건
        </h2>
        <ul className="list-disc pl-6 space-y-2 w-fit">
          {Array.isArray(problem.conditions) && problem.conditions.length > 0
            ? (problem.conditions as string[]).map(
                (condition: string, index: number) => (
                  <li key={index}>
                    <div className="prose prose-invert max-w-none break-words whitespace-pre-wrap prose-p:my-0 prose-ul:my-0 prose-ol:my-0">
                      <ReactMarkdown
                        remarkPlugins={[
                          [remarkMath, { singleDollarTextMath: true }],
                          remarkGfm,
                        ]}
                        rehypePlugins={[
                          [rehypeKatex, { output: "html", strict: "ignore" }],
                        ]}
                      >
                        {normalizeMarkdown(condition)}
                      </ReactMarkdown>
                    </div>
                  </li>
                ),
              )
            : "조건이 없습니다."}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit ">
          입력
        </h2>
        <div className="prose prose-invert max-w-none break-words whitespace-pre-wrap">
          <ReactMarkdown
            remarkPlugins={[
              [remarkMath, { singleDollarTextMath: true }],
              remarkGfm,
            ]}
            rehypePlugins={[
              [rehypeKatex, { output: "html", strict: "ignore" }],
            ]}
          >
            {normalizeMarkdown(
              problem.input_description
                ? problem.input_description
                : "입력 설명이 없습니다.",
            )}
          </ReactMarkdown>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          출력
        </h2>
        <div className="prose prose-invert max-w-none break-words whitespace-pre-wrap">
          <ReactMarkdown
            remarkPlugins={[
              [remarkMath, { singleDollarTextMath: true }],
              remarkGfm,
            ]}
            rehypePlugins={[
              [rehypeKatex, { output: "html", strict: "ignore" }],
            ]}
          >
            {normalizeMarkdown(problem.output_description)}
          </ReactMarkdown>
        </div>
      </div>
      {(() => {
        const sampleInputs: string[] = Array.isArray(problem.sample_inputs)
          ? problem.sample_inputs
          : [];
        const sampleOutputs: string[] = Array.isArray(problem.sample_outputs)
          ? problem.sample_outputs
          : [];
        return sampleInputs.length > 0 && sampleOutputs.length > 0
          ? sampleInputs.map((sample_input: string, index: number) => (
              <div
                key={index}
                className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8"
              >
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-4 border-b-2 border-primary w-fit">
                    <h2 className="text-2xl font-semibold">
                      예제 입력 {index + 1}
                    </h2>
                    <CopyButton text={sample_input} />
                  </div>
                  <pre className="bg-gray-800 text-white p-4 rounded-md whitespace-pre-wrap">
                    {sample_input}
                  </pre>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-4 border-b-2 border-primary w-fit">
                    <h2 className="text-2xl font-semibold">
                      예제 출력 {index + 1}
                    </h2>
                    <CopyButton text={sampleOutputs[index] ?? ""} />
                  </div>
                  <pre className="bg-gray-800 text-white p-4 rounded-md whitespace-pre-wrap">
                    {sampleOutputs[index] ?? ""}
                  </pre>
                </div>
              </div>
            ))
          : null;
      })()}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
          출처
        </h2>
        <ul className="list-disc list-inside w-fit">
          {[
            {
              key: "문제를 만든 사람",
              value: creatorName,
            },
            {
              key: "원본 문제",
              value: problem.source,
            },
          ].map(
            (
              data: {
                key: string;
                value: string;
              },
              index: number,
            ) => {
              if (!data.value) return null;
              return (
                <li key={index} className="mb-2">
                  {data.key}: {data.value}
                </li>
              );
            },
          )}
        </ul>
      </div>
      {Array.isArray(problem.tags) && (problem.tags as string[]).length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold border-b-2 border-primary w-fit">
            태그
          </h2>
          <div
            role="list"
            aria-label="문제 태그"
            className="flex flex-wrap gap-2"
          >
            {(problem.tags as string[]).map((tag: string, idx: number) => (
              <div
                role="listitem"
                key={`${tag}-${idx}`}
                className="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-1.5 shadow-sm hover:bg-gray-800 transition"
                title={tag}
              >
                <TagsIcon
                  className="w-4 h-4 text-gray-300"
                  aria-hidden="true"
                />
                <span className="text-sm text-gray-100">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemPage;
