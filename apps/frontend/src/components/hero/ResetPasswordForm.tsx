"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

import { Bounce, toast } from "react-toastify";

import { createClient } from "@lib/supabase/client";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const ResetPasswordForm = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const hasToken = token.length > 0;

  const supabase = createClient();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const showError = React.useCallback(
    (message: string) => {
      toast.error(message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: theme === "dark" ? "dark" : "light",
        transition: Bounce,
      });
    },
    [theme],
  );

  const showSuccess = React.useCallback(
    (message: string) => {
      toast.success(message, {
        position: "top-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: theme === "dark" ? "dark" : "light",
        transition: Bounce,
      });
    },
    [theme],
  );

  const handleRequestReset = async () => {
    if (!isValidEmail(email)) {
      showError("올바른 이메일을 입력해 주세요.");
      return;
    }

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      showError(error.message ?? "재설정 메일 요청에 실패했습니다.");
      return;
    }

    showSuccess("재설정 링크를 이메일로 보냈습니다.");
    setEmail("");
  };

  const handleConfirmReset = async () => {
    if (!hasToken) {
      showError("재설정 토큰이 없습니다.");
      return;
    }

    if (password.length < 8) {
      showError("비밀번호는 최소 8자 이상이어야 합니다.");
      setPassword("");
      setConfirmPassword("");
      return;
    }

    if (password !== confirmPassword) {
      showError("비밀번호가 일치하지 않습니다.");
      setPassword("");
      setConfirmPassword("");
      return;
    }

    const { error } = await supabase.auth.confirmPasswordReset({
      token,
      password,
    });

    if (error) {
      showError(error.message ?? "비밀번호 재설정에 실패했습니다.");
      return;
    }

    showSuccess("비밀번호가 재설정되었습니다. 로그인 페이지로 이동합니다.");
    router.replace("/login?reset=success");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (hasToken) {
        await handleConfirmReset();
      } else {
        await handleRequestReset();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-5/6 md:w-2/5 2xl:w-1/4 shadow-md p-8 rounded-lg text-center flex flex-col gap-4 border-2 border-gray-700/40"
    >
      <h1 className="text-2xl font-black">
        {hasToken ? "Reset Password" : "Forgot Password"}
      </h1>

      {hasToken ? (
        <>
          <div className="flex flex-col">
            <label className="text-left font-medium py-2">New Password</label>
            <input
              className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
              type="password"
              value={password}
              placeholder="Enter your new password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-left font-medium py-2">Confirm Password</label>
            <input
              className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
              type="password"
              value={confirmPassword}
              placeholder="Re-enter your new password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          <label className="text-left font-medium py-2">Email address</label>
          <input
            className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
            type="email"
            value={email}
            placeholder="Enter your email address"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={
          `px-4 py-2 rounded-lg font-bold transition-all duration-300 ease-in-out shadow-md flex items-center justify-center gap-2 ` +
          (isSubmitting
            ? "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300 cursor-not-allowed hover:scale-100"
            : "bg-primary text-white hover:scale-110 hover:cursor-pointer")
        }
      >
        {isSubmitting && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}
        {isSubmitting ? "처리중..." : hasToken ? "비밀번호 변경" : "재설정 링크 보내기"}
      </button>

      <h1 className="text-right text-sm text-gray-500">
        <Link href="/login" className="underline">
          로그인으로 돌아가기
        </Link>
      </h1>
    </form>
  );
};

export default ResetPasswordForm;
