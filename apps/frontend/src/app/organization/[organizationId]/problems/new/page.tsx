"use client";

import React, { JSX, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { X, CalendarClock } from "lucide-react";
import Editor from "@monaco-editor/react";
import { User } from "@supabase/auth-js";
import { motion, AnimatePresence } from "framer-motion";
import { Bounce, toast } from "react-toastify";
import { FaJava } from "react-icons/fa";
import { SiC, SiCplusplus, SiPython } from "react-icons/si";
import { PiStarFourFill } from "react-icons/pi"; // expert
import { BsGraphUpArrow, BsGraphDownArrow, BsEmojiSmile } from "react-icons/bs"; // intermediate

import type { Language } from "@lib/types";
import { createClient } from "@lib/supabase/client";

const ALL_LANGUAGES: { value: Language; label: string; icon: JSX.Element }[] = [
  {
    value: "python",
    label: "Python",
    icon: <SiPython className="text-blue-500" />,
  },
  {
    value: "java",
    label: "Java",
    icon: <FaJava className="text-orange-600" />,
  },
  { value: "c", label: "C", icon: <SiC className="text-cyan-700" /> },
  {
    value: "cpp",
    label: "C++",
    icon: <SiCplusplus className="text-blue-700" />,
  },
];

function isValidDate(dateStr: string) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function toInputLocal(dateIso: string | null | undefined) {
  if (!dateIso) return "";
  try {
    return new Date(dateIso).toLocaleString("sv-SE", {
      timeZone: "Asia/Seoul",
    });
  } catch {
    return "";
  }
}

const NewProblemPage = () => {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editProblemId, setEditProblemId] = useState<number | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Add availableLanguages and grade state
  const [availableLanguages, setAvailableLanguages] = useState<
    ("python" | "java" | "c" | "cpp")[]
  >([]);
  const [grade, setGrade] = useState<
    "expert" | "advanced" | "intermediate" | "beginner" | ""
  >("");
  const [code, setCode] = useState(`#include <stdio.h>

int solution(int a, int b, int c) {
  /* put your code here */
}

int main(void) {
  int a, b, c;

  // Read three integers from the user
  scanf("%d %d %d", &a, &b, &c);
  
  // Call the solution function and print the median value
  printf("%d", solution(a, b, c));
  
  return 0;
}
`);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [memoryLimit, setMemoryLimit] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState(
    new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Seoul",
    }),
  );
  const [inputDescription, setInputDescription] = useState("");
  const [outputDescription, setOutputDescription] = useState("");
  const [conditions, setConditions] = useState<string[]>([""]);
  const [examplePairs, setExamplePairs] = useState([{ input: "", output: "" }]);

  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");

  const [editorTheme, setEditorTheme] = useState("light");
  const { theme } = useTheme();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요합니다.", {
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
        return;
      }
      setUser(user);
    };

    fetchUser();
  }, [supabase, theme]);

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  useEffect(() => {
    const idStr = searchParams.get("id");
    if (!idStr) return;
    const idNum = Number(idStr);
    if (Number.isNaN(idNum)) return;

    setLoadingExisting(true);
    setEditProblemId(idNum);

    (async () => {
      const { data, error } = await supabase
        .from("problems")
        .select(
          "id, title, description, published_at, created_by, input_description, output_description, conditions, sample_inputs, sample_outputs, default_code, time_limit, memory_limit, organization_id, deadline, available_languages, grade",
        )
        .eq("id", idNum)
        .single();

      if (error || !data) {
        toast.error("문제를 불러오지 못했습니다.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: theme === "dark" ? "dark" : "light",
          transition: Bounce,
        });
        setLoadingExisting(false);
        return;
      }

      setIsEditing(true);
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setPublishedAt(data.published_at ? toInputLocal(data.published_at) : "");
      setInputDescription(data.input_description ?? "");
      setOutputDescription(data.output_description ?? "");
      setConditions(
        Array.isArray(data.conditions) && data.conditions.length
          ? data.conditions
          : [""],
      );

      const si = Array.isArray(data.sample_inputs) ? data.sample_inputs : [];
      const so = Array.isArray(data.sample_outputs) ? data.sample_outputs : [];
      const maxLen = Math.max(si.length, so.length);
      setExamplePairs(
        (maxLen ? Array.from({ length: maxLen }) : [{}]).map((_, i) => ({
          input: si[i] ?? "",
          output: so[i] ?? "",
        })) as { input: string; output: string }[],
      );

      setCode(data.default_code ?? "");
      setTimeLimit(
        typeof data.time_limit === "number" ? data.time_limit : null,
      );
      setMemoryLimit(
        typeof data.memory_limit === "number" ? data.memory_limit : null,
      );

      const has = !!data.deadline;
      setHasDeadline(has);
      setDeadline(has && data.deadline ? toInputLocal(data.deadline) : "");

      // Set availableLanguages and grade if present
      setAvailableLanguages(
        Array.isArray(data.available_languages) ? data.available_languages : [],
      );
      setGrade(data.grade ?? "");

      toast.success("기존 문제를 불러왔어요.", {
        position: "top-right",
        autoClose: 1400,
        hideProgressBar: true,
        closeOnClick: true,
        theme: theme === "dark" ? "dark" : "light",
        transition: Bounce,
      });

      setLoadingExisting(false);
    })();
  }, [searchParams, supabase, theme]);

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      <div className="flex flex-col justify-center gap-8 p-6">
        {isEditing && (
          <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm">
            현재 <strong>문제 #{editProblemId}</strong> 수정 중입니다.
          </div>
        )}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">제목</h1>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="문제 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">문제 설명</h1>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none min-h-[150px]"
            placeholder="문제에 대한 설명을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">공개 날짜 및 시간</h1>
          <input
            type="datetime-local"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" />
            마감 기한 (선택)
          </h1>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {hasDeadline ? "마감 설정됨" : "마감 없음"}
              </span>
            </label>
          </div>
          <AnimatePresence>
            {hasDeadline && (
              <motion.input
                key="deadline-input"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                type="datetime-local"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">조건</h1>
          <div className="flex gap-2 flex-wrap">
            {[">", "<", "≥", "≤"].map((symbol, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setConditions((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] += symbol;
                    return updated;
                  });
                }}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
              >
                {symbol}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {conditions.map((condition, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex gap-2 items-center"
              >
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => {
                    const newConditions = [...conditions];
                    newConditions[index] = e.target.value;
                    setConditions(newConditions);
                  }}
                  className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder={`조건 ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (conditions.length <= 1) {
                      toast.error("조건은 무조건 1개 있어야 합니다.", {
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
                      return;
                    }
                    setConditions(conditions.filter((_, i) => i !== index));
                  }}
                  className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setConditions([...conditions, ""])}
            className="self-start px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            조건 추가
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">입력 설명</h1>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none min-h-[150px]"
            placeholder="입력 형식에 대한 설명을 입력하세요"
            value={inputDescription}
            onChange={(e) => setInputDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">출력 설명</h1>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-none min-h-[150px]"
            placeholder="출력 형식에 대한 설명을 입력하세요"
            value={outputDescription}
            onChange={(e) => setOutputDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">예시 입/출력</h1>
          <AnimatePresence>
            {examplePairs.map((pair, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2 border border-gray-300 dark:border-gray-600 rounded-md p-3"
              >
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold">예시 #{index + 1}</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setExamplePairs(
                        examplePairs.filter((_, i) => i !== index),
                      )
                    }
                    className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <textarea
                  value={pair.input}
                  onChange={(e) => {
                    const newPairs = [...examplePairs];
                    newPairs[index].input = e.target.value;
                    setExamplePairs(newPairs);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="예시 입력"
                />
                <textarea
                  value={pair.output}
                  onChange={(e) => {
                    const newPairs = [...examplePairs];
                    newPairs[index].output = e.target.value;
                    setExamplePairs(newPairs);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="예시 출력"
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() =>
              setExamplePairs([...examplePairs, { input: "", output: "" }])
            }
            className="self-start px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            예시 추가
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">문제 코드 기본값</h1>
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-6">
        <div className="flex flex-col gap-4 px-6">
          <h1 className="text-2xl font-bold">제출 가능 언어</h1>
          <div className="flex gap-2 flex-wrap">
            {ALL_LANGUAGES.map(({ value, label, icon }) => {
              const isSelected = availableLanguages.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAvailableLanguages((prev) =>
                      isSelected
                        ? prev.filter((l) => l !== value)
                        : [...prev, value],
                    );
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all duration-200 transform ${
                    isSelected
                      ? "bg-blue-600 text-white scale-105"
                      : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                  } hover:scale-105`}
                >
                  {icon}
                  <span className="capitalize">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6">
          <h1 className="text-2xl font-bold">난이도</h1>
          <div className="flex gap-2 flex-wrap">
            {(["expert", "advanced", "intermediate", "beginner"] as const).map(
              (level) => {
                const isActive = grade === level;
                const baseStyle =
                  "flex items-center gap-1 px-3 py-1 rounded-md border text-sm cursor-pointer transition-all transform duration-200";
                const activeStyle = "bg-blue-600 text-white scale-105";
                const inactiveStyle =
                  "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white hover:scale-105";

                const icon = {
                  expert: <PiStarFourFill className="text-red-600" />,
                  advanced: <BsGraphUpArrow className="text-orange-500" />,
                  intermediate: (
                    <BsGraphDownArrow className="text-yellow-500" />
                  ),
                  beginner: <BsEmojiSmile className="text-green-600" />,
                }[level];

                const label = {
                  expert: "최상급",
                  advanced: "상급",
                  intermediate: "중급",
                  beginner: "초급",
                }[level];

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setGrade(level)}
                    className={`${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
                  >
                    {icon}
                    {label}
                  </button>
                );
              },
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xl font-bold">시간 제한 (ms)</label>
          <input
            type="number"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="예: 2000"
            value={timeLimit === null ? "" : timeLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setTimeLimit(value);
              } else {
                setTimeLimit(null);
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xl font-bold">메모리 제한 (MB)</label>
          <input
            type="number"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="예: 128"
            value={memoryLimit === null ? "" : memoryLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setMemoryLimit(value);
              } else {
                setMemoryLimit(null);
              }
            }}
          />
        </div>
      </div>
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          모든 정보를 입력한 후{" "}
          <strong className="text-black dark:text-white">
            &quot;{isEditing ? "수정" : "생성"}&quot;
          </strong>{" "}
          버튼을 눌러 문제를 등록하세요.
        </div>
        <button
          disabled={loadingExisting}
          className={
            "bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition self-end md:self-auto" +
            (loadingExisting ? " opacity-60 cursor-not-allowed" : "")
          }
          onClick={async () => {
            if (
              !title ||
              !description ||
              !publishedAt ||
              !inputDescription ||
              !outputDescription ||
              availableLanguages.length == 0 ||
              !grade
            ) {
              toast.error("모든 필수 정보를 입력하세요.", {
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
              return;
            }

            if (!conditions.every((c) => c.trim() !== "")) {
              toast.error("모든 조건이 비어있지 않아야 합니다.", {
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
              return;
            }

            if (!examplePairs.every((e) => e.output.trim() !== "")) {
              toast.error("모든 예시 출력이 비어있지 않아야 합니다.", {
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
              return;
            }

            if (!isValidDate(publishedAt)) {
              toast.error("유효한 날짜 및 시간을 입력하세요.", {
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
              return;
            }

            if (hasDeadline && !isValidDate(deadline)) {
              toast.error("유효한 마감 기한을 입력하세요.", {
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
              return;
            }

            const payload = {
              title,
              description,
              created_by: user?.id,
              input_description: inputDescription,
              output_description: outputDescription,
              conditions,
              sample_inputs: examplePairs.map((pair) => pair.input),
              sample_outputs: examplePairs.map((pair) => pair.output),
              published_at: new Date(publishedAt).toISOString(),
              default_code: code,
              time_limit: timeLimit,
              memory_limit: memoryLimit,
              organization_id: parseInt(params.organizationId),
              deadline: hasDeadline ? new Date(deadline).toISOString() : null,
              available_languages: availableLanguages,
              grade: grade || null,
            };

            if (isEditing && editProblemId) {
              const { error } = await supabase
                .from("problems")
                .update({
                  ...payload,
                })
                .eq("id", editProblemId);

              if (error) {
                toast.error("수정 중 오류가 발생했습니다.", {
                  position: "top-right",
                  autoClose: 3000,
                  hideProgressBar: true,
                  closeOnClick: true,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
              } else {
                toast.success("수정이 완료되었습니다.", {
                  position: "top-right",
                  autoClose: 1400,
                  hideProgressBar: true,
                  closeOnClick: true,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
              }
            } else {
              const { error } = await supabase.from("problems").insert(payload);
              if (error) {
                toast.error("생성 중 오류가 발생했습니다.", {
                  position: "top-right",
                  autoClose: 3000,
                  hideProgressBar: true,
                  closeOnClick: true,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
              } else {
                toast.success("문제가 생성되었습니다.", {
                  position: "top-right",
                  autoClose: 1400,
                  hideProgressBar: true,
                  closeOnClick: true,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
                router.push(`/organization/${params.organizationId}/problems`);
                router.refresh();
              }
            }
          }}
        >
          {isEditing ? "수정" : "생성"}
        </button>
      </div>
    </div>
  );
};

export default NewProblemPage;
