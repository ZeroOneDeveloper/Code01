"use client";

import React from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

const OrganizationTabs: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  // const searchParams = useSearchParams();

  return (
    <div className="flex gap-1">
      {[
        {
          label: "유저",
          href: `/organization/${id}`,
          isActive: pathname === `/organization/${id}`,
        },
        {
          label: "문제",
          href: `/organization/${id}/problems`,
          isActive: pathname === `/organization/${id}/problems`,
        },
        {
          label: "제출 기록",
          href: `/organization/${id}/submissions`,
          isActive: pathname === `/organization/${id}/submissions`,
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
