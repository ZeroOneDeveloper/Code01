"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { X } from "lucide-react";
import Editor from "@monaco-editor/react";
import { User } from "@supabase/auth-js";
import { motion, AnimatePresence } from "framer-motion";
import { Bounce, toast } from "react-toastify";

import { createClient } from "@lib/supabase/client";

function isValidDate(dateStr: string) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

const NewProblemPage = () => {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      <div className="flex flex-col justify-center gap-8 p-6">
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
            &quot;생성&quot;
          </strong>{" "}
          버튼을 눌러 문제를 등록하세요.
        </div>
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition self-end md:self-auto"
          onClick={async () => {
            if (
              !title ||
              !description ||
              !publishedAt ||
              !inputDescription ||
              !outputDescription
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

            await supabase.from("problems").insert({
              title,
              description,
              created_by: user?.id,
              input_description: inputDescription,
              output_description: outputDescription,
              sample_inputs: examplePairs.map((pair) => pair.input),
              sample_outputs: examplePairs.map((pair) => pair.output),
              time_limit: timeLimit,
              memory_limit: memoryLimit,
              published_at: new Date(publishedAt).toISOString(),
              default_code: code,
            });
          }}
        >
          생성
        </button>
      </div>
    </div>
  );
};

export default NewProblemPage;
