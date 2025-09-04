"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Link as LinkIcon,
  Calendar,
  Timer,
  MemoryStick,
  Wrench,
} from "lucide-react";

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
  className?: string;
}> = ({ icon: Icon, children, className = "" }) => (
  <div className="flex items-center gap-2 min-w-0">
    <Icon className={`w-5 h-5 shrink-0 ${className}`} />
    <span className={`text-sm font-semibold truncate ${className}`}>
      {children}
    </span>
  </div>
);

const CardInner: React.FC<{ problem: Problem }> = ({ problem }) => {
  const hasDeadline = !!problem.deadline;
  const date = hasDeadline
    ? new Date(problem.deadline as string)
    : new Date(problem.published_at);
  const datePrefix = hasDeadline ? "마감" : "게시일";

  const dateColor = hasDeadline
    ? "text-rose-500 dark:text-rose-400"
    : "text-sky-500 dark:text-sky-400";

  return (
    <>
      <h1 className="text-left text-xl font-bold truncate">{problem.title}</h1>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail icon={LinkIcon}>{problem.id}</Detail>
        <Detail icon={Calendar} className={dateColor}>
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
  manageTestsHref?: string;
}> = ({ problem, href, onClick, manageTestsHref }) => {
  const router = useRouter();
  const className =
    "group flex flex-col gap-3 border border-gray-300/70 rounded-xl px-5 py-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5";

  const ManageButton = () =>
    manageTestsHref ? (
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          aria-label="테스트 케이스 관리"
          onClick={(e) => {
            e.stopPropagation(); // 부모 Link/버튼 클릭 전파 방지
            router.push(manageTestsHref);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300/80 bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 shadow-sm"
        >
          <Wrench className="w-4 h-4" />
          테스트 케이스 관리
        </button>
      </div>
    ) : null;

  if (href) {
    return (
      <Link href={href} className={className}>
        <CardInner problem={problem} />
        <ManageButton />
      </Link>
    );
  }
  if (onClick) {
    return (
      <button className={className} onClick={onClick}>
        <CardInner problem={problem} />
        <ManageButton />
      </button>
    );
  }
  return (
    <div className={className}>
      <CardInner problem={problem} />
      <ManageButton />
    </div>
  );
};

export default ProblemCard;
