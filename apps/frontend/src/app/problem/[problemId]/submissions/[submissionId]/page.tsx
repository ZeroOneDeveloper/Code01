"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { User } from "@supabase/auth-js";
import Editor from "@monaco-editor/react";
import Link from "next/link";

import { createClient } from "@lib/supabase/client";
import { Problem, Submission, UserProfile, toStatusKo } from "@lib/types";
import { Bounce, toast } from "react-toastify";
import { useTheme } from "next-themes";

const SubmissionCodePage: React.FC = () => {
  const { theme } = useTheme();
  const supabase = createClient();
  const params = useParams<{ problemId: string; submissionId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [submissionLoaded, setSubmissionLoaded] = useState(false);
  const [code, setCode] = useState<string>("");

  const [problem, setProblem] = useState<Problem | null>(null);
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [editorTheme, setEditorTheme] = useState<string>("light");
  const [editorHeight, setEditorHeight] = useState<`${number}vh`>("30vh");

  const totalCases = submission?.cases_total ?? 0;
  const doneCases = submission?.cases_done ?? 0;
  const progressPct = useMemo(() => {
    if (!totalCases || totalCases <= 0) return 0;
    const pct = Math.floor((doneCases / totalCases) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [doneCases, totalCases]);

  const timeText = useMemo(
    () => (submission?.time_ms ? `${submission.time_ms} ms` : "제한없음"),
    [submission?.time_ms],
  );
  const memoryText = useMemo(
    () => (submission?.memory_kb ? `${submission.memory_kb} KB` : "제한없음"),
    [submission?.memory_kb],
  );

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  useEffect(() => {
    const fetchProblem = async () => {
      if (!params.problemId) return;
      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("id", params.problemId)
        .single();
      if (error) {
        console.error("Error fetching problem:", error);
        setProblem(null);
      } else {
        setProblem(data as Problem);
      }
    };
    fetchProblem();
  }, [params.problemId, supabase]);

  useEffect(() => {
    if (submission?.code) {
      setCode(submission.code);
    } else {
      setCode("");
    }
  }, [submission]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      } else {
        setUser(data.user);

        if (data.user) {
          const profileData = await supabase
            .from("users")
            .select("*")
            .eq("id", data.user.id)
            .single();

          if (profileData.error) {
            console.error("Error fetching user profile:", profileData.error);
            setProfile(null);
          } else {
            setProfile(profileData.data);
          }
        }
      }
      setUserLoaded(true);
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!params.problemId || !params.submissionId) {
        setSubmissionLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from("problem_submissions")
        .select("*")
        .eq("id", params.submissionId)
        .eq("problem_id", params.problemId)
        .single();

      if (error) {
        console.error("Error fetching submission:", error);
        setSubmission(null);
      } else {
        setSubmission(data);
      }
      setSubmissionLoaded(true);
    };

    fetchSubmission();
  }, [params.problemId, params.submissionId, supabase]);

  // Wait until both fetches finish (user may be null if not logged in)
  if (!userLoaded || !submissionLoaded) {
    return <div>Loading...</div>;
  }

  // If submission not found
  if (!submission) {
    return <div>제출물을 찾을 수 없습니다.</div>;
  }

  const canView = (user && submission.user_id === user.id) || profile?.is_admin;

  if (!canView) {
    return <div>이 제출물은 비공개입니다. 본인 제출물만 열람할 수 있어요.</div>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      toast.success("정상적으로 복사되었습니다.", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: theme === "dark" ? "dark" : "light",
        transition: Bounce,
      });
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  // Map language to filename for download
  const LANGUAGE_FILENAME_MAP: Record<string, string> = {
    c: "main.c",
    cpp: "main.cpp",
    python: "main.py",
    java: "Main.java",
  };
  const handleDownload = () => {
    try {
      const blob = new Blob([code || ""], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      // Use mapped filename, fallback to txt
      const lang = submission?.language;
      const filename =
        lang && LANGUAGE_FILENAME_MAP[lang]
          ? LANGUAGE_FILENAME_MAP[lang]
          : `submission_${String(params.submissionId)}.txt`;
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            {problem?.title || `Problem #${String(params.problemId)}`}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>Submission #{String(params.submissionId)}</span>
            <span className="hidden sm:inline">·</span>
            {submission?.submitted_at && (
              <span>
                제출 {new Date(submission.submitted_at).toLocaleString()}
              </span>
            )}
            <span className="hidden sm:inline">·</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${submission?.is_correct ? "border-green-600 text-green-700" : "border-rose-600 text-rose-700"}`}
            >
              {submission?.is_correct ? "정답" : "오답"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/problem/${String(params.problemId)}`}
            className="text-sm underline underline-offset-4"
          >
            문제 페이지로 이동
          </Link>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Editor column */}
        <div className="lg:col-span-8 space-y-3">
          {/* Result summary */}
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${submission?.is_correct ? "border-green-600 text-green-700" : "border-rose-600 text-rose-700"}`}
              >
                {submission?.is_correct ? "정답" : "오답"}
              </span>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                상태: {submission ? toStatusKo(submission.status_code) : ""}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${submission?.passed_time_limit ? "text-green-700 border-green-600" : "text-rose-700 border-rose-600"}`}
              >
                시간제한 {submission?.passed_time_limit ? "통과" : "실패"}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${submission?.passed_memory_limit ? "text-green-700 border-green-600" : "text-rose-600 border-rose-600"}`}
              >
                메모리제한 {submission?.passed_memory_limit ? "통과" : "실패"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">시간</div>
                <div className="font-medium">{timeText}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">메모리</div>
                <div className="font-medium">{memoryText}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">케이스</div>
                <div className="font-medium">
                  {doneCases}/{totalCases}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">전체 통과</div>
                <div className="font-medium">
                  {submission?.passed_all ? "Yes" : "No"}
                </div>
              </div>
            </div>

            <div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-green-600"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {progressPct}%
              </div>
            </div>
          </div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <button
              onClick={handleCopy}
              className="rounded-md border px-2 py-1 text-sm"
            >
              복사
            </button>
            <button
              onClick={handleDownload}
              className="rounded-md border px-2 py-1 text-sm"
            >
              다운로드
            </button>
            <div className="mx-2 h-5 w-px bg-border" />
            <button
              onClick={() => setMinimapEnabled((v) => !v)}
              className="rounded-md border px-2 py-1 text-sm"
            >
              미니맵 {minimapEnabled ? "켜짐" : "꺼짐"}
            </button>
            <div className="mx-2 h-5 w-px bg-border" />
            <div className="flex items-center gap-1">
              <span className="text-sm">폰트</span>
              <button
                onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                className="rounded-md border px-2 py-1 text-sm"
              >
                -
              </button>
              <span className="text-sm tabular-nums">{fontSize}</span>
              <button
                onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                className="rounded-md border px-2 py-1 text-sm"
              >
                +
              </button>
            </div>
            <div className="mx-2 h-5 w-px bg-border" />
            <button
              onClick={() =>
                setEditorHeight((h) => (h === "30vh" ? "60vh" : "30vh"))
              }
              className="rounded-md border px-2 py-1 text-sm"
            >
              {editorHeight === "30vh" ? "확대" : "축소"}
            </button>
          </div>

          {code ? (
            <Editor
              height={editorHeight}
              defaultLanguage="c"
              value={code}
              onChange={(value) => value && setCode(value)}
              theme={editorTheme}
              options={{
                fontSize,
                minimap: { enabled: minimapEnabled },
                scrollBeyondLastLine: false,
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              코드가 비어 있습니다.
            </div>
          )}
        </div>

        {/* Sidebar with problem info and constraints */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="rounded-md border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">문제 정보</h2>
            </div>
            {problem?.deadline && (
              <p className="text-sm text-muted-foreground">
                마감: {new Date(problem.deadline).toLocaleString()}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">시간 제한</div>
                <div className="font-medium">
                  {problem?.time_limit
                    ? `${problem.time_limit} ms`
                    : "제한없음"}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">메모리 제한</div>
                <div className="font-medium">
                  {problem?.memory_limit
                    ? `${problem.memory_limit} KB`
                    : "제한없음"}
                </div>
              </div>
            </div>
            <details className="group rounded-md border p-3">
              <summary className="cursor-pointer list-none select-none text-sm font-medium">
                입력 형식
              </summary>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {problem?.input_description?.trim() || "설명이 없습니다."}
              </div>
            </details>
            <details className="group rounded-md border p-3">
              <summary className="cursor-pointer list-none select-none text-sm font-medium">
                출력 형식
              </summary>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {problem?.output_description?.trim() || "설명이 없습니다."}
              </div>
            </details>
            <details className="group rounded-md border p-3">
              <summary className="cursor-pointer list-none select-none text-sm font-medium">
                제한 조건
              </summary>
              <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed">
                {(problem?.conditions?.length
                  ? problem.conditions
                  : ["제한 조건이 없습니다."]
                ).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
            <details className="group rounded-md border p-3">
              <summary className="cursor-pointer list-none select-none text-sm font-medium">
                샘플 I/O
              </summary>
              <div className="mt-2 space-y-3">
                {Array.from({
                  length: Math.max(
                    problem?.sample_inputs?.length ?? 0,
                    problem?.sample_outputs?.length ?? 0,
                  ),
                }).map((_, i) => (
                  <div key={i} className="rounded-md border p-2">
                    <div className="mb-1 text-xs text-muted-foreground">
                      샘플 {i + 1}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          입력
                        </div>
                        <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
                          {problem?.sample_inputs?.[i] ?? ""}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          출력
                        </div>
                        <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
                          {problem?.sample_outputs?.[i] ?? ""}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SubmissionCodePage;
