"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import axios from "axios";
import Editor from "@monaco-editor/react";

import Checkbox from "@components/Checkbox";

const ProblemSubmitForm: React.FC<{
  userId: string;
  problemId: string;
  defaultCode: string;
}> = ({ userId, problemId, defaultCode }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [editorTheme, setEditorTheme] = useState("light");
  const [code, setCode] = useState<string>(defaultCode);

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  const [visibility, setVisibility] = useState<
    "public" | "private" | "correct"
  >("public");

  return (
    <div className="flex flex-col gap-8 w-full xl:w-4/5 mx-auto">
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
          소스 코드
        </div>
        <Editor
          height="30vh"
          defaultLanguage="c"
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
        className="bg-primary w-fit px-4 py-2"
        onClick={() => {
          axios
            .post(`${process.env.NEXT_PUBLIC_API_URL}/runner/`, {
              userId,
              problemId,
              code,
              language: "c",
              visibility,
            })
            .then((res) => {
              const pendingId = res.data.pendingId;
              router.push(
                `/problem/${problemId}/submissions?user_id=true&pendingId=${pendingId}`,
              );
            });
        }}
      >
        제출
      </button>
    </div>
  );
};

export default ProblemSubmitForm;
