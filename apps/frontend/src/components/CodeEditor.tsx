"use client";

import React, { useState } from "react";

import Editor from "@monaco-editor/react";
import axios from "axios";

const CodeEditor: React.FC = () => {
  const [code, setCode] = useState<string>("");
  return (
    <div>
      <Editor
        height="80vh"
        width="50%"
        defaultLanguage="c"
        value={code}
        onChange={(value) => setCode(value || "")}
        theme="vs-dark"
      />
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
        onClick={() => {
          axios
            .post("/api/createProblem", {
              code: code,
            })
            .then((response) => {
              console.log("Response:", response.data.result);
            });
        }}
      >
        Run
      </button>
    </div>
  );
};

export default CodeEditor;
