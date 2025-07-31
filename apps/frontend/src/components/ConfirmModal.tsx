"use client";

import React, { useState, useCallback } from "react";
import { ShieldUser, UserMinus } from "lucide-react";

type Member = {
  id: string;
  name: string;
  studentId: string;
  nickname: string;
  email: string;
  role: string;
  joinedAt: string;
};

export default function ConfirmModal({ members }: { members: Member[] }) {
  const [modal, setModal] = useState<{
    type: "promote" | "remove";
    userId: string;
  } | null>(null);

  const handleConfirm = useCallback(() => {
    if (!modal) return;
    if (modal.type === "promote") {
      console.log(`Promoting user ${modal.userId}`);
    } else {
      console.log(`Removing user ${modal.userId}`);
    }
    setModal(null);
  }, [modal]);

  return (
    <>
      <table className="w-full table-auto border-collapse text-sm text-center">
        <thead>
          <tr className="border-b">
            {[
              "이름",
              "학번",
              "닉네임",
              "이메일",
              "역할",
              "가입 시간",
              "동작",
            ].map((header, i) => (
              <th key={i} className="p-2 text-center">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member, idx) => (
            <tr key={idx} className="border-b">
              {[
                member.name,
                member.studentId,
                member.nickname,
                member.email,
                member.role,
                new Date(member.joinedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                }),
              ].map((v, i) => (
                <td key={i} className="p-2 text-center truncate">
                  {i === 4 ? (
                    <span className="flex items-center justify-center gap-1">
                      {v === "admin" ? "👑 관리자" : "🙋‍♂️ 멤버"}
                    </span>
                  ) : (
                    v || "─"
                  )}
                </td>
              ))}
              <td className="p-2 text-center flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    setModal({ type: "remove", userId: member.id })
                  }
                >
                  <UserMinus className="w-6 h-auto bg-red-400 p-1 rounded-md text-white dark:text-black" />
                </button>
                <button
                  onClick={() =>
                    setModal({ type: "promote", userId: member.id })
                  }
                >
                  <ShieldUser className="w-6 h-auto bg-blue-400 p-1 rounded-md text-white dark:text-black" />
                </button>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-gray-500">
                유저가 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
              {modal.type === "promote"
                ? "관리자로 승격하시겠습니까?"
                : "정말로 삭제하시겠습니까?"}
            </h2>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                확인
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
