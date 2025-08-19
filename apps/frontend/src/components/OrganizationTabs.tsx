"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

const OrganizationTabs: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {[
        {
          label: "유저",
          href: `/organization/${organizationId}`,
          isActive: pathname === `/organization/${organizationId}`,
        },
        {
          label: "문제",
          href: `/organization/${organizationId}/problems`,
          isActive: pathname === `/organization/${organizationId}/problems`,
        },
        {
          label: "퀴즈",
          href: `/organization/${organizationId}/quizzes`,
          isActive: pathname.startsWith(
            `/organization/${organizationId}/quizzes`,
          ),
        },
        {
          label: "제출 기록",
          href: `/organization/${organizationId}/submissions`,
          isActive: pathname === `/organization/${organizationId}/submissions`,
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

export default OrganizationTabs;
