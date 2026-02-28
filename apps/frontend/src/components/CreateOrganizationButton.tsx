"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

import { createClient } from "@lib/supabase/client";

export default function CreateOrganizationButton() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setOpen(false);
    setName("");
    setIsPrivate(false);
    setError(null);
    setLoading(false);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
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
        .insert([{ name: trimmed, is_private: isPrivate, created_by: userId }]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      resetState();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-teal-500/60 bg-teal-500/15 px-3 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-500/25 transition-colors"
      >
        <Plus className="h-4 w-4" />
        새 Organization
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => !loading && resetState()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-lg border border-gray-700 bg-[#202228] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <h2 className="text-lg font-semibold text-gray-100">
                Organization 생성
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                조직 이름과 공개 여부를 설정하세요.
              </p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-200">
                    이름
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 2026 알고리즘 스터디"
                    className="w-full rounded-md border border-gray-600 bg-[#16181d] px-3 py-2 text-sm text-gray-100 outline-none focus:border-teal-400"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="h-4 w-4"
                  />
                  비공개 조직으로 생성
                </label>

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  disabled={loading}
                  className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700/30 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="rounded-md border border-teal-500/70 bg-teal-500/25 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/35 disabled:opacity-60"
                >
                  {loading ? "생성 중..." : "생성"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
