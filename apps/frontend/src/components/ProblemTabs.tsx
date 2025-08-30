"use client";

import React, { useEffect, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { createClient } from "@lib/supabase/client";

const ProblemTabs: React.FC = () => {
  const supabase = createClient();
  const { problemId } = useParams<{ problemId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPastDeadline, setIsPastDeadline] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const idNum = Number(problemId);
        if (!problemId || Number.isNaN(idNum)) {
          setIsPastDeadline(false);
          return;
        }
        const { data, error } = await supabase
          .from("problems")
          .select("deadline")
          .eq("id", idNum)
          .single();
        if (error) {
          console.error("ProblemTabs: error fetching deadline", error);
          setIsPastDeadline(false);
          return;
        }
        if (!data?.deadline) {
          setIsPastDeadline(false);
          return;
        }
        const d = new Date(data.deadline as string);
        setIsPastDeadline(d.getTime() < Date.now());
      } catch (e) {
        console.error("ProblemTabs: deadline check failed", e);
        setIsPastDeadline(false);
      }
    };
    run();
  }, [problemId, supabase]);

  return (
    <div className="flex gap-1">
      {(() => {
        const tabs = [
          {
            label: `${problemId}번`,
            href: `/problem/${problemId}`,
            isActive: pathname === `/problem/${problemId}`,
            disabled: false,
          },
          {
            label: "제출",
            href: `/problem/${problemId}/submit`,
            isActive: pathname === `/problem/${problemId}/submit`,
            disabled: isPastDeadline,
          },
          {
            label: "내 제출",
            href: `/problem/${problemId}/submissions?user_id=true`,
            isActive:
              pathname === `/problem/${problemId}/submissions` &&
              searchParams.get("user_id") === "true",
            disabled: false,
          },
          {
            label: "제출 기록",
            href: `/problem/${problemId}/submissions`,
            isActive:
              pathname === `/problem/${problemId}/submissions` &&
              !searchParams.get("user_id"),
            disabled: false,
          },
        ];
        return tabs.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) router.push(item.href);
            }}
            title={item.disabled ? "마감되어 제출할 수 없습니다." : undefined}
            aria-disabled={item.disabled || undefined}
            className={`text-black cursor-pointer dark:text-white px-6 py-2 font-medium ${
              item.isActive
                ? "text-white bg-primary"
                : item.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:text-primary hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200"
            }`}
          >
            {item.label}
            {item.disabled && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground align-middle">
                <span aria-hidden>🔒</span>
                <span>마감</span>
              </span>
            )}
          </button>
        ));
      })()}
    </div>
  );
};

export default ProblemTabs;
