"use client";

import React from "react";
import { motion } from "framer-motion";

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
  const [email, setEmail] = React.useState(user.email);
  const [role, setRole] = React.useState(user.is_admin ? "관리자" : "유저");

  const [isEdited, setIsEdited] = React.useState(false);
  return (
    <form className="mt-6 space-y-4">
      {[
        {
          label: "학번",
          value: studentId,
          htmlFor: "studentId",
          onChange: setStudentId,
          disabled: false,
        },
        {
          label: "닉네임",
          value: nickname,
          htmlFor: "nickname",
          onChange: setNickname,
          disabled: false,
        },
        {
          label: "이름",
          value: fullName,
          htmlFor: "fullName",
          onChange: setFullName,
          disabled: false,
        },
        {
          label: "이메일 주소",
          value: email,
          htmlFor: "email",
          onChange: setEmail,
          disabled: true,
        },
        {
          label: "역할",
          value: role,
          htmlFor: "role",
          onChange: setRole,
          disabled: true,
        },
      ].map((item, i) => (
        <div key={i}>
          <label
            htmlFor={item.htmlFor}
            className="block text-sm font-medium mb-1 text-black dark:text-white"
          >
            {item.label}
          </label>
          <input
            id={item.htmlFor}
            name={item.htmlFor}
            type="text"
            value={item.value}
            onChange={(e) => {
              item.onChange(e.target.value);
              setIsEdited(true);
            }}
            disabled={item.disabled}
            className={`w-full rounded border border-gray-300 dark:border-gray-700 dark:bg-gray-900 px-3 py-2 ${item.disabled ? "bg-gray-100 dark:bg-gray-900 text-gray-500 cursor-not-allowed" : "bg-gray-50 text-black dark:bg-gray-800 dark:text-white"}`}
          />
        </div>
      ))}

      <motion.button
        initial={false}
        animate={{
          backgroundColor: isEdited ? "#2563eb" : "#d1d5db",
          color: isEdited ? "#ffffff" : "#9ca3af",
          cursor: isEdited ? "pointer" : "not-allowed",
        }}
        whileHover={isEdited ? { scale: 1.05 } : {}}
        transition={{ duration: 0.3 }}
        className="text-sm font-medium px-4 py-2 rounded"
        disabled={!isEdited}
        onClick={async (e) => {
          e.preventDefault();
          if (!isEdited) return;

          await updateUserProfile(studentId, nickname, fullName);

          setIsEdited(false);
        }}
      >
        프로필 수정
      </motion.button>
    </form>
  );
};

export default DashboardForm;
