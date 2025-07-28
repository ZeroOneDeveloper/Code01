"use client";

import React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const ProblemTabs: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

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
          label: "제출 기록",
          href: `/problem/${id}/submissions`,
          isActive: pathname === `/problem/${id}/submissions`,
        },
      ].map((item, index) => (
        <Link
          key={index}
          href={item.href}
          className={`text-black dark:text-white px-6 py-2 font-medium ${item.isActive ? "text-white bg-primary" : "hover:text-primary hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200"}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};

export default ProblemTabs;
