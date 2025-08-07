import React from "react";
import Link from "next/link";

import { Link as LinkIcon, Calendar, Timer, MemoryStick } from "lucide-react";

import { Problem } from "@lib/types";

const ProblemCard: React.FC<{
  problem: Problem;
  href?: string;
  onClick?: () => void;
}> = ({ problem, href, onClick }) => {
  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-4 border border-gray-300 px-6 py-4 rounded-lg shadow-md transition hover:scale-105 cursor-pointer"
      >
        <h1 className="text-left text-2xl font-bold truncate">
          {problem.title}
        </h1>
        <div className="flex items-center gap-2">
          <LinkIcon className="w-6 h-auto" />
          <h1 className="text-lg font-bold">{problem.id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {new Date(problem.published_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {problem.time_limit ? `${problem.time_limit} ms` : "제한없음"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MemoryStick className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {problem.memory_limit ? `${problem.memory_limit} MB` : "제한없음"}
          </h1>
        </div>
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        className="flex flex-col gap-4 border border-gray-300 px-6 py-4 rounded-lg shadow-md transition hover:scale-105 cursor-pointer"
        onClick={onClick}
      >
        <h1 className="text-left text-2xl font-bold truncate">
          {problem.title}
        </h1>
        <div className="flex items-center gap-2">
          <LinkIcon className="w-6 h-auto" />
          <h1 className="text-lg font-bold">{problem.id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {new Date(problem.published_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {problem.time_limit ? `${problem.time_limit} ms` : "제한없음"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MemoryStick className="w-6 h-auto" />
          <h1 className="text-lg font-bold">
            {problem.memory_limit ? `${problem.memory_limit} MB` : "제한없음"}
          </h1>
        </div>
      </button>
    );
  }
};

export default ProblemCard;
