"use client";

import { useState } from "react";
import { createClient } from "@lib/supabase/client";

export default function AdminToggle({
  userId,
  userName,
  initialValue,
  isSelf,
}: {
  userId: string;
  userName: string;
  initialValue: boolean;
  isSelf: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (isSelf) return;

    const action = isAdmin ? "관리자 권한을 해제" : "관리자 권한을 부여";
    if (!window.confirm(`${userName}님의 ${action}하시겠습니까?`)) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("users")
        .update({ is_admin: !isAdmin })
        .eq("id", userId);

      if (!error) {
        setIsAdmin(!isAdmin);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading || isSelf}
      title={isSelf ? "자기 자신의 권한은 변경할 수 없습니다" : isAdmin ? "관리자 해제" : "관리자 부여"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        isSelf
          ? "cursor-not-allowed opacity-50"
          : loading
            ? "cursor-wait"
            : "cursor-pointer"
      } ${isAdmin ? "bg-emerald-500" : "bg-gray-400 dark:bg-neutral-600"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          isAdmin ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
