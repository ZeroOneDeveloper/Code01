"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AnimatePresence, motion } from "framer-motion";
import { User, Lock, LockOpen, Calendar, Plus } from "lucide-react";

import { createClient } from "@lib/supabase/client";

const OrganizationCard: React.FC<{
  organization?: {
    id: string;
    name: string;
    is_private: boolean;
    created_by: string;
    created_at: string;
  };
  organizationMemberCount?: number;
}> = ({ organization, organizationMemberCount }) => {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!organization) {
    const handleCreate = async () => {
      if (!name.trim()) {
        setError("이름을 입력해 주세요.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        if (!userId) {
          setError("로그인 상태가 아닙니다.");
          setLoading(false);
          return;
        }

        const { error: insertError } = await supabase
          .from("organizations")
          .insert([{ name, is_private: isPrivate, created_by: userId }]);

        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }

        setOpen(false);
        setName("");
        setIsPrivate(false);
        setLoading(false);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "생성 중 오류가 발생했습니다.");
        setLoading(false);
      }
    };

    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-full"
          aria-label="Create new organization"
        >
          <div className="flex flex-col gap-4 border-gray-300 px-6 py-4 rounded-lg shadow-md transition hover:scale-105 cursor-pointer w-full h-full justify-center items-center border-2 border-dashed hover:border-blue-400 hover:dark:border-blue-400 dark:border-gray-600">
            <div className="flex flex-col items-center gap-2">
              <Plus className="w-8 h-auto" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                새 Organization 만들기
              </span>
            </div>
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center backdrop-brightness-75 backdrop-blur-sm"
              onClick={() => !loading && setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <h2 className="text-lg font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
                  새로운 Organization 생성
                </h2>

                <div className="flex flex-col gap-4 mb-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Organization Name
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예) Algorithm Study Group"
                      className="border border-gray-300 dark:border-gray-600 bg-transparent rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      비공개로 만들기
                    </span>
                  </label>

                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                  >
                    {loading ? "생성 중..." : "확인"}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="px-4 py-2 rounded bg-gray-300 text-gray-800 hover:bg-gray-400 disabled:opacity-60"
                  >
                    취소
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
  return (
    <Link
      href={`/organization/${organization.id}`}
      className="flex flex-col gap-4 border border-gray-300 px-6 py-4 rounded-lg shadow-md transition hover:scale-105 cursor-pointer"
    >
      <h1 className="text-left text-xl font-bold truncate">
        {organization.name}
      </h1>
      <div className="flex items-center gap-2">
        <User className="w-8 h-auto" />
        <h1 className="text-xl font-bold">{organizationMemberCount}</h1>
      </div>
      {organization.is_private ? (
        <div className="flex items-center gap-2">
          <Lock className="w-8 h-auto" />
          <h1 className="text-xl font-bold">비공개 조직</h1>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <LockOpen className="w-8 h-auto" />
          <h1 className="text-xl font-bold">공개 조직</h1>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Calendar className="w-8 h-auto" />
        <h1 className="text-xl font-bold">
          {new Date(organization.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}
        </h1>
      </div>
    </Link>
  );
};

export default OrganizationCard;
