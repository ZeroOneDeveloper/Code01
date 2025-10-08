"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";

import { Bounce, toast } from "react-toastify";

import { createClient } from "@lib/supabase/client";

const LoginForm = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const code = useSearchParams().get("code");

  const supabase = createClient();

  useEffect(() => {
    if (!code) return;

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (!error) {
        router.push("/");
        router.refresh();
      }
    });
  }, [code, supabase, router]);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    supabase.auth
      .signInWithPassword({
        email,
        password,
      })
      .then(({ error }) => {
        if (error) {
          toast.error("이메일/비밀번호를 확인해주세요.", {
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
          setIsSubmitting(false);
        } else {
          window.location.replace("/");
        }
      });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-5/6 md:w-2/5 2xl:w-1/5 shadow-md p-8 rounded-lg text-center flex flex-col gap-4 border-2 border-gray-700/40"
    >
      <h1 className="text-2xl font-black">Login</h1>
      <div className="flex flex-col">
        <label htmlFor="email" className="text-left font-medium py-2">
          Email address
        </label>
        <input
          className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
          type="email"
          value={email}
          placeholder="Enter your email address"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="password" className="text-left font-medium py-2">
          Password
        </label>
        <input
          className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
          type="password"
          value={password}
          placeholder="Enter your password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
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
        {isSubmitting ? "처리중..." : "로그인"}
      </button>
      <h1 className="text-right text-sm text-gray-500">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="underline">
          회원가입
        </Link>
      </h1>
    </form>
  );
};

export default LoginForm;
