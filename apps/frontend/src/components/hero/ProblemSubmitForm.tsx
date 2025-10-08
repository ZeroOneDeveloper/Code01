"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import axios from "axios";
import Editor from "@monaco-editor/react";
import { FaJava } from "react-icons/fa";
import { SiC, SiCplusplus, SiPython } from "react-icons/si";

import Checkbox from "@components/Checkbox";
import { Language } from "@lib/types";

const ProblemSubmitForm: React.FC<{
  userId: string;
  problemId: string;
  defaultCode: string;
  availableLanguages: Language[];
}> = ({ userId, problemId, defaultCode, availableLanguages }) => {
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
  const [code, setCode] = useState<string>(defaultCode);
  const [visibility, setVisibility] = useState<
    "public" | "private" | "correct"
  >("public");
  const [language, setLanguage] = useState<Language>(availableLanguages[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  return (
    <div className="flex flex-col gap-8 w-full mx-auto">
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
              <span className="text-gray-700 dark:text-gray-300">
                {v.label}
              </span>
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
          onChange={(value) => value && setCode(value)}
          theme={editorTheme}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
          }}
        />
      </div>

      <button
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={`bg-primary w-fit px-4 py-2 rounded-md text-white font-semibold transition-transform duration-200 hover:scale-105 flex items-center gap-2 ${
          isSubmitting ? "opacity-60 cursor-not-allowed" : ""
        }`}
        onClick={() => {
          if (isSubmitting) return;
          setIsSubmitting(true);
          axios
            .post(`${process.env.NEXT_PUBLIC_API_URL}/runner/`, {
              userId,
              problemId,
              code,
              language,
              visibility,
            })
            .then((res) => {
              const pendingId = res.data.pendingId;
              router.push(
                `/problem/${problemId}/submissions?user_id=true&pendingId=${pendingId}`,
              );
            })
            .finally(() => setIsSubmitting(false));
        }}
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
