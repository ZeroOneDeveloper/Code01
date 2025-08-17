import React from "react";
import Link from "next/link";

import { Link as LinkIcon, Calendar, Timer, MemoryStick } from "lucide-react";

import { Problem } from "@lib/types";

function formatKoreanDate(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const Detail: React.FC<{
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 min-w-0">
    <Icon className="w-5 h-5 shrink-0" />
    <span className="text-sm font-semibold truncate">{children}</span>
  </div>
);

const CardInner: React.FC<{ problem: Problem }> = ({ problem }) => {
  const hasDeadline = !!problem.deadline;
  const date = hasDeadline
    ? new Date(problem.deadline as string)
    : new Date(problem.published_at);
  const datePrefix = hasDeadline ? "마감" : "게시일";

  return (
    <>
      <h1 className="text-left text-xl font-bold truncate">{problem.title}</h1>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail icon={LinkIcon}>{problem.id}</Detail>
        <Detail icon={Calendar}>
          {datePrefix} · {formatKoreanDate(date)}
        </Detail>
        <Detail icon={Timer}>
          {problem.time_limit ? `${problem.time_limit} ms` : "제한없음"}
        </Detail>
        <Detail icon={MemoryStick}>
          {problem.memory_limit ? `${problem.memory_limit} MB` : "제한없음"}
        </Detail>
      </div>
    </>
  );
};

const ProblemCard: React.FC<{
  problem: Problem;
  href?: string;
  onClick?: () => void;
}> = ({ problem, href, onClick }) => {
  const className =
    "group flex flex-col gap-3 border border-gray-300/70 rounded-xl px-5 py-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5";

  if (href) {
    return (
      <Link href={href} className={className}>
        <CardInner problem={problem} />
      </Link>
    );
  }
  if (onClick) {
    return (
      <button className={className} onClick={onClick}>
        <CardInner problem={problem} />
      </button>
    );
  }
  return (
    <div className={className}>
      <CardInner problem={problem} />
    </div>
  );
};

export default ProblemCard;
