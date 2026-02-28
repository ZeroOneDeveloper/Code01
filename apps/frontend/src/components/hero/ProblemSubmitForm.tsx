"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import axios from "axios";
import Editor from "@monaco-editor/react";
import { FaJava } from "react-icons/fa";
import { SiC, SiCplusplus, SiPython } from "react-icons/si";

import Checkbox from "@components/Checkbox";
import { getClientApiBaseUrl } from "@lib/api-base";
import { Language } from "@lib/types";

type QuizSubmitContext = {
  quizId: number;
  organizationId: number;
  endAt: string | null;
  timeLimitSec: number | null;
  attemptStartedAt?: string | null;
  nextProblemId?: number | null;
};

const toMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const formatRemain = (remainMs: number): string => {
  if (remainMs <= 0) return "0초";
  const totalSec = Math.floor(remainMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
};

const ProblemSubmitForm: React.FC<{
  userId: string;
  problemId: string;
  defaultCode: string;
  availableLanguages: Language[];
  quizSubmitContext?: QuizSubmitContext | null;
  forceAutoSubmit?: boolean;
}> = ({
  userId,
  problemId,
  defaultCode,
  availableLanguages,
  quizSubmitContext = null,
  forceAutoSubmit = false,
}) => {
  const detectLikelyLanguage = (
    sourceCode: string,
  ): "c" | "cpp" | "python" | "java" | "c_cpp" | null => {
    const text = sourceCode.trim();
    if (!text) return null;

    if (/^\s*#include\s+</m.test(text)) {
      if (/std::|using\s+namespace\s+std|cin\s*>>|cout\s*<</m.test(text)) {
        return "cpp";
      }
      return "c_cpp";
    }
    if (/\bpublic\s+class\b|\bimport\s+java\./m.test(text)) {
      return "java";
    }
    if (
      /^\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/m.test(text) ||
      /^\s*import\s+[a-zA-Z0-9_.]+\s*$/m.test(text)
    ) {
      return "python";
    }

    return null;
  };

  const getLanguageIcon = (lang: Language) => {
    switch (lang) {
      case "python":
        return <SiPython className="text-blue-500" />;
      case "c":
        return <SiC className="text-cyan-700" />;
      case "cpp":
        return <SiCplusplus className="text-blue-700" />;
      case "java":
        return <FaJava className="text-orange-600" />;
      default:
        return null;
    }
  };

  const { theme } = useTheme();
  const router = useRouter();
  const [editorTheme, setEditorTheme] = useState("light");
  const [code, setCode] = useState<string>(defaultCode ?? "");
  const [visibility, setVisibility] = useState<"public" | "private" | "correct">(
    "public",
  );
  const [language, setLanguage] = useState<Language>(availableLanguages[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSubmittingMessage, setAutoSubmittingMessage] = useState<string | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [effectiveDeadlineMs, setEffectiveDeadlineMs] = useState<number | null>(null);

  const isQuizMode = !!quizSubmitContext;
  const draftKey = useMemo(
    () =>
      isQuizMode
        ? `quiz-draft:${quizSubmitContext!.quizId}:${problemId}:${userId}`
        : `problem-draft:${problemId}:${userId}`,
    [isQuizMode, problemId, quizSubmitContext, userId],
  );
  const entryAtKey = useMemo(
    () =>
      isQuizMode ? `quiz-entry-at:${quizSubmitContext!.quizId}:${userId}` : null,
    [isQuizMode, quizSubmitContext, userId],
  );
  const autoSubmittedKey = useMemo(
    () =>
      isQuizMode
        ? `quiz-autosubmitted:${quizSubmitContext!.quizId}:${problemId}:${userId}`
        : null,
    [isQuizMode, problemId, quizSubmitContext, userId],
  );
  const autoSubmitStartedRef = useRef(false);

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  useEffect(() => {
    try {
      const savedCode = window.localStorage.getItem(draftKey);
      if (savedCode !== null) {
        setCode(savedCode);
      }
    } catch {
      // ignore localStorage failures
    }
  }, [draftKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, code ?? "");
      } catch {
        // ignore localStorage failures
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [code, draftKey]);

  useEffect(() => {
    if (!isQuizMode || !entryAtKey) return;
    try {
      const raw = window.localStorage.getItem(entryAtKey);
      const parsed = raw ? Number(raw) : NaN;
      if (!raw || Number.isNaN(parsed) || parsed <= 0) {
        window.localStorage.setItem(entryAtKey, String(Date.now()));
      }
    } catch {
      // ignore localStorage failures
    }
  }, [entryAtKey, isQuizMode]);

  useEffect(() => {
    if (!quizSubmitContext) {
      setEffectiveDeadlineMs(null);
      return;
    }

    const candidates: number[] = [];
    const endAtMs = toMs(quizSubmitContext.endAt);
    if (endAtMs !== null) {
      candidates.push(endAtMs);
    }

    if (
      typeof quizSubmitContext.timeLimitSec === "number" &&
      quizSubmitContext.timeLimitSec > 0 &&
      entryAtKey
    ) {
      let entryAtMs = toMs(quizSubmitContext.attemptStartedAt) ?? Date.now();

      if (toMs(quizSubmitContext.attemptStartedAt) === null) {
        try {
          const raw = window.localStorage.getItem(entryAtKey);
          const parsed = raw ? Number(raw) : NaN;
          if (!Number.isNaN(parsed) && parsed > 0) {
            entryAtMs = parsed;
          } else {
            window.localStorage.setItem(entryAtKey, String(entryAtMs));
          }
        } catch {
          // ignore localStorage failures
        }
      } else {
        try {
          window.localStorage.setItem(entryAtKey, String(entryAtMs));
        } catch {
          // ignore localStorage failures
        }
      }
      candidates.push(entryAtMs + quizSubmitContext.timeLimitSec * 1000);
    }

    setEffectiveDeadlineMs(candidates.length > 0 ? Math.min(...candidates) : null);
  }, [entryAtKey, quizSubmitContext]);

  useEffect(() => {
    if (!isQuizMode && !forceAutoSubmit) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [forceAutoSubmit, isQuizMode]);

  const remainingMs =
    effectiveDeadlineMs !== null ? Math.max(0, effectiveDeadlineMs - nowMs) : null;
  const isExpired =
    forceAutoSubmit ||
    (effectiveDeadlineMs !== null && nowMs >= effectiveDeadlineMs);

  const submitToRunner = useCallback(
    async (sourceCode: string): Promise<number> => {
      const res = await axios.post(`${getClientApiBaseUrl()}/runner/`, {
        userId,
        problemId,
        code: sourceCode,
        language,
        visibility,
        quizId: quizSubmitContext?.quizId ?? null,
      });
      const pendingId = Number(res?.data?.pendingId);
      if (!Number.isFinite(pendingId)) {
        throw new Error("pendingId가 올바르지 않습니다.");
      }
      return pendingId;
    },
    [language, problemId, quizSubmitContext, userId, visibility],
  );

  useEffect(() => {
    if (!isQuizMode || !isExpired) return;
    if (autoSubmitStartedRef.current) return;
    autoSubmitStartedRef.current = true;

    const runAutoSubmit = async () => {
      setIsSubmitting(true);
      setAutoSubmittingMessage("시간이 종료되어 현재 코드를 자동 제출하고 있습니다...");

      try {
        window.localStorage.setItem(draftKey, code ?? "");
      } catch {
        // ignore localStorage failures
      }

      try {
        if (autoSubmittedKey) {
          const existing = window.localStorage.getItem(autoSubmittedKey);
          const existingId = existing ? Number(existing) : NaN;
          if (!Number.isNaN(existingId) && existingId > 0) {
            router.replace(
              `/problem/${problemId}/submissions?user_id=true&pendingId=${existingId}&auto_submitted=true`,
            );
            return;
          }
        }

        let pendingId: number | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            pendingId = await submitToRunner(code);
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
        }

        if (pendingId !== null) {
          try {
            if (autoSubmittedKey) {
              window.localStorage.setItem(autoSubmittedKey, String(pendingId));
            }
            window.localStorage.removeItem(draftKey);
          } catch {
            // ignore localStorage failures
          }
          router.replace(
            `/problem/${problemId}/submissions?user_id=true&pendingId=${pendingId}&auto_submitted=true`,
          );
          return;
        }

        if (quizSubmitContext) {
          router.replace(
            `/quiz/${quizSubmitContext.organizationId}/${quizSubmitContext.quizId}`,
          );
        } else {
          router.replace(`/problem/${problemId}/submissions?user_id=true`);
        }
      } finally {
        setIsSubmitting(false);
        setAutoSubmittingMessage(null);
      }
    };

    void runAutoSubmit();
  }, [
    autoSubmittedKey,
    code,
    draftKey,
    isExpired,
    isQuizMode,
    problemId,
    quizSubmitContext,
    router,
    submitToRunner,
  ]);

  const handleManualSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const selectedLanguage = String(language ?? "").toLowerCase();
    const likelyLanguage = detectLikelyLanguage(code);
    if (likelyLanguage) {
      const isMatch =
        likelyLanguage === selectedLanguage ||
        (likelyLanguage === "c_cpp" &&
          (selectedLanguage === "c" || selectedLanguage === "cpp"));
      if (!isMatch) {
        const ok = window.confirm(
          `선택 언어는 "${selectedLanguage}"인데 코드 형태는 "${likelyLanguage}"로 보입니다.\n그대로 제출하시겠습니까?`,
        );
        if (!ok) {
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      window.localStorage.setItem(draftKey, code ?? "");
    } catch {
      // ignore localStorage failures
    }

    try {
      const pendingId = await submitToRunner(code);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore localStorage failures
      }

      if (quizSubmitContext) {
        const assignmentKey = `quiz-assignment:${quizSubmitContext.quizId}:${userId}`;
        let assignedOrder: number[] = [];
        try {
          const raw = window.localStorage.getItem(assignmentKey);
          if (raw) {
            const parsed = JSON.parse(raw) as number[];
            if (Array.isArray(parsed)) {
              assignedOrder = parsed
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id));
            }
          }
        } catch {
          // ignore localStorage failures
        }

        let nextProblemId =
          typeof quizSubmitContext.nextProblemId === "number" &&
          Number.isFinite(quizSubmitContext.nextProblemId)
            ? quizSubmitContext.nextProblemId
            : null;

        if (!nextProblemId) {
          const current = Number(problemId);
          const idx = assignedOrder.findIndex((id) => id === current);
          if (idx >= 0 && idx < assignedOrder.length - 1) {
            const candidate = assignedOrder[idx + 1];
            if (Number.isFinite(candidate)) {
              nextProblemId = candidate;
            }
          }
        }

        if (nextProblemId) {
          let nextNextProblemId: number | null = null;
          const nextIdx = assignedOrder.findIndex(
            (id) => id === Number(nextProblemId),
          );
          if (nextIdx >= 0 && nextIdx < assignedOrder.length - 1) {
            const candidate = assignedOrder[nextIdx + 1];
            if (Number.isFinite(candidate)) {
              nextNextProblemId = candidate;
            }
          }

          const nextHref = nextNextProblemId
            ? `/problem/${nextProblemId}/submit?quizId=${quizSubmitContext.quizId}&nextProblemId=${nextNextProblemId}`
            : `/problem/${nextProblemId}/submit?quizId=${quizSubmitContext.quizId}`;
          router.push(
            nextHref,
          );
          return;
        }

        router.push(
          `/quiz/${quizSubmitContext.organizationId}/${quizSubmitContext.quizId}`,
        );
        return;
      }

      router.push(`/problem/${problemId}/submissions?user_id=true&pendingId=${pendingId}`);
    } catch {
      window.alert("제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full mx-auto">
      {isQuizMode && effectiveDeadlineMs !== null && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-200">
          <div className="text-xs opacity-80">자동 제출까지 남은 시간</div>
          <div className="text-sm font-semibold">{formatRemain(remainingMs ?? 0)}</div>
        </div>
      )}

      {autoSubmittingMessage && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-700 dark:text-rose-200">
          {autoSubmittingMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row w-full gap-4">
        <div className="min-w-[6rem] text-left md:text-right pt-1 whitespace-nowrap">
          제출 여부 공개
        </div>
        <div className="flex flex-col gap-2">
          {[
            { label: "공개", value: "public" },
            { label: "비공개", value: "private" },
            { label: "정답시 공개", value: "correct" },
          ].map((v, index) => (
            <label key={index} className="flex items-center gap-2">
              <Checkbox
                checked={visibility === v.value}
                onChange={(checked) => {
                  setVisibility(
                    checked
                      ? (v.value as "public" | "private" | "correct")
                      : "public",
                  );
                }}
              />
              <span className="text-gray-700 dark:text-gray-300">{v.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row w-full gap-4">
        <div className="min-w-[6rem] text-left md:text-right pt-1 whitespace-nowrap">
          언어 선택
        </div>
        <div className="flex flex-wrap gap-2">
          {availableLanguages.map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex items-center gap-1 px-3 py-1 rounded-md border text-sm transition-all transform duration-200 ${
                lang === language
                  ? "bg-primary text-white border-primary scale-105"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white hover:scale-105"
              }`}
            >
              {getLanguageIcon(lang)}
              {lang}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row w-full gap-4">
        <div className="min-w-[6rem] text-left md:text-right pt-1 whitespace-nowrap">
          소스 코드
        </div>
        <Editor
          height="30vh"
          key={language}
          defaultLanguage={language}
          value={code}
          onChange={(value) => setCode(value ?? "")}
          theme={editorTheme}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
          }}
        />
      </div>

      <button
        type="button"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={`bg-primary w-fit px-4 py-2 rounded-md text-white font-semibold transition-transform duration-200 hover:scale-105 flex items-center gap-2 ${
          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
        }`}
        onClick={handleManualSubmit}
      >
        {isSubmitting && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}
        {isSubmitting ? "제출 중..." : "제출"}
      </button>
    </div>
  );
};

export default ProblemSubmitForm;
