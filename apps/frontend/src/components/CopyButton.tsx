"use client";

import React from "react";

const CopyButton: React.FC<{
  text: string;
}> = ({ text }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => alert("복사되었습니다!"));
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-primary hover:underline"
    >
      복사
    </button>
  );
};

export default CopyButton;
