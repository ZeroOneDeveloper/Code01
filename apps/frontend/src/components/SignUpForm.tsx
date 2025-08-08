"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bounce, toast } from "react-toastify";

import { createClient } from "@lib/supabase/client";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const notifyError = (message: string) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: false,
    draggable: true,
    theme: localStorage.getItem("theme") || "light",
    transition: Bounce,
  });
};

const SignUpForm = () => {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const supabase = createClient();

  return (
    <div className="w-5/6 md:w-1/6 shadow-md p-8 rounded-lg text-center flex flex-col gap-4 border-2 border-gray-700/40">
      <h1 className="text-2xl font-black">Sign Up</h1>
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
      <div className="flex flex-col">
        <label className="text-left font-medium py-2">Password</label>
        <input
          className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
          type="password"
          value={password}
          placeholder="Enter your password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-left font-medium py-2">Confirm Password</label>
        <input
          className="w-full dark:bg-[#28282d] text-black dark:text-white px-4 py-2 shadow-md rounded-lg border-2 border-gray-200 dark:border-gray-400/30 focus:outline-none dark:focus:border-gray-300 transition-colors"
          type="password"
          value={confirmPassword}
          placeholder="Re-enter your password"
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <button
        className="bg-primary text-white px-4 py-2 rounded-lg font-bold transition-all duration-300 ease-in-out hover:scale-110 shadow-md hover:cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          if (!isValidEmail(email)) {
            notifyError("이메일 형식이 올바르지 않습니다.");
            return;
          }
          if (password.length < 8) {
            notifyError("비밀번호는 최소 8자 이상이어야 합니다.");
            setPassword("");
            setConfirmPassword("");
            return;
          }
          if (password !== confirmPassword) {
            notifyError("비밀번호가 일치하지 않습니다.");
            setPassword("");
            setConfirmPassword("");
            return;
          }
          supabase.auth
            .signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/login`,
              },
            })
            .then(({ error }) => {
              if (error) {
                notifyError("이메일/비밀번호를 확인해주세요.");
              } else {
                console.log("Login successful");
                router.push("/welcome");
              }
            });
        }}
        type="submit"
      >
        회원가입
      </button>
      <h1 className="text-right text-sm text-gray-500">
        계정이 이미 있으신가요?{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </h1>
    </div>
  );
};

export default SignUpForm;
