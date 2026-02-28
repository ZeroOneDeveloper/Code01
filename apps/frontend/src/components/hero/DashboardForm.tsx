"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

import { UserProfile } from "@lib/types";

const DashboardForm: React.FC<{
  user: UserProfile;
  updateUserProfile: (
    student_id: string,
    nickname: string,
    name: string,
  ) => Promise<{
    success?: boolean;
    error?: string;
  }>;
}> = ({ user, updateUserProfile }) => {
  const [studentId, setStudentId] = React.useState(user.student_id || "");
  const [nickname, setNickname] = React.useState(user.nickname || "");
  const [fullName, setFullName] = React.useState(user.name || "");
  const [isEdited, setIsEdited] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const readonlyRole = user.is_admin ? "관리자" : "유저";

  const onFieldChange =
    (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setIsEdited(true);
      setFeedback(null);
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isEdited || isSaving) return;

    setIsSaving(true);
    setFeedback(null);
    const result = await updateUserProfile(studentId, nickname, fullName);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
      setIsSaving(false);
      return;
    }

    setFeedback({ type: "success", message: "프로필이 저장되었습니다." });
    setIsEdited(false);
    setIsSaving(false);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold text-gray-100">프로필 정보</h2>
        <p className="mt-1 text-sm text-gray-400">
          학번, 닉네임, 이름을 최신 상태로 유지하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="studentId"
            className="mb-1 block text-sm font-medium text-gray-200"
          >
            학번
          </label>
          <input
            id="studentId"
            name="studentId"
            type="text"
            value={studentId}
            onChange={onFieldChange(setStudentId)}
            className="w-full rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-gray-100 outline-none focus:border-teal-400"
          />
        </div>

        <div>
          <label
            htmlFor="nickname"
            className="mb-1 block text-sm font-medium text-gray-200"
          >
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={nickname}
            onChange={onFieldChange(setNickname)}
            className="w-full rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-gray-100 outline-none focus:border-teal-400"
          />
        </div>

        <div>
          <label
            htmlFor="fullName"
            className="mb-1 block text-sm font-medium text-gray-200"
          >
            이름
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={onFieldChange(setFullName)}
            className="w-full rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-gray-100 outline-none focus:border-teal-400"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-200"
          >
            이메일 주소
          </label>
          <input
            id="email"
            name="email"
            type="text"
            value={user.email}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-gray-700 bg-[#0e1118] px-3 py-2 text-gray-400"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="role"
            className="mb-1 block text-sm font-medium text-gray-200"
          >
            역할
          </label>
          <input
            id="role"
            name="role"
            type="text"
            value={readonlyRole}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-gray-700 bg-[#0e1118] px-3 py-2 text-gray-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isEdited || isSaving}
          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
            isEdited && !isSaving
              ? "border-teal-500/70 bg-teal-500/20 text-teal-200 hover:bg-teal-500/30"
              : "cursor-not-allowed border-gray-700 bg-gray-800/70 text-gray-500"
          }`}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "저장 중..." : "프로필 저장"}
        </button>

        {feedback?.type === "success" && (
          <p className="inline-flex items-center gap-1 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {feedback.message}
          </p>
        )}
        {feedback?.type === "error" && (
          <p className="inline-flex items-center gap-1 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
};

export default DashboardForm;
