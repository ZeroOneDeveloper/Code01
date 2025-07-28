"use client";

import React from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

const ProblemTabs: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex gap-1">
      {[
        {
          label: `${id}번`,
          href: `/problem/${id}`,
          isActive: pathname === `/problem/${id}`,
        },
        {
          label: "제출",
          href: `/problem/${id}/submit`,
          isActive: pathname === `/problem/${id}/submit`,
        },
        {
          label: "내 제출",
          href: `/problem/${id}/submissions?user_id=true`,
          isActive:
            pathname === `/problem/${id}/submissions` &&
            searchParams.get("user_id") === "true",
        },
        {
          label: "제출 기록",
          href: `/problem/${id}/submissions`,
          isActive:
            pathname === `/problem/${id}/submissions` &&
            !searchParams.get("user_id"),
        },
      ].map((item, index) => (
        <button
          key={index}
          onClick={() => {
            router.push(item.href);
          }}
          className={`text-black cursor-pointer dark:text-white px-6 py-2 font-medium ${item.isActive ? "text-white bg-primary" : "hover:text-primary hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ProblemTabs;
