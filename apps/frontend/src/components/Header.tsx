"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { User } from "@supabase/auth-js";
import { CircleUserRound, Menu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { UserProfile } from "@lib/types";
import ThemeToggle from "@components/ThemeToggle";
import { DarkLogo, LightLogo } from "@components/Logo";
import { createClient } from "@lib/supabase/client";

const menuItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    adminOnly: true,
    className: "text-emerald-600 dark:text-emerald-500",
  },
  {
    label: "Organization",
    href: "/organization",
    adminOnly: true,
    className: "text-orange-600 dark:text-orange-400",
  },
  {
    label: "Manage account",
    href: "/account",
    className: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Log out",
    href: "/logout",
    className: "text-red-600 dark:text-red-400",
    action: "logout",
  },
];

export default function Header() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        !mobileMenuButtonRef.current?.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
        } else {
          setUserProfile(data);
        }
      } else {
        setUserProfile(null);
      }
    })();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  return (
    <nav className="w-full flex justify-between md:justify-around items-center px-8 md:px-0 py-8 z-50">
      <div className="w-6 block md:hidden" />
      <Link href="/" className="transition-all duration-500 ease-in-out">
        <LightLogo className="w-24 md:w-36 hidden dark:block" />
        <DarkLogo className="w-24 md:w-36 block dark:hidden" />
      </Link>

      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-2">
        <ThemeToggle />
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent
             hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-300 ease-in-out"
            >
              <CircleUserRound className="h-6 w-6 dark:text-gray-100" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  key="dropdown"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-56 rounded-md shadow-xl bg-white dark:bg-[#1e1e1e]  z-50"
                >
                  <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    Signed in as
                    <br />
                    <span className="font-semibold truncate">
                      {user.email ?? "Loading..."}
                    </span>
                  </div>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  {menuItems.map((item, i) => {
                    if (item.adminOnly && !userProfile?.is_admin) return null;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (item.action === "logout") {
                            handleLogout();
                          } else {
                            router.push(item.href);
                          }
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${item.className} hover:bg-gray-100 dark:hover:bg-[#2a2a2a]`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="dark:bg-[#2a2a2a] bg-[#d5d5d5] dark:text-white text-black font-bold px-4 py-2 rounded-xl transition-all duration-300 ease-in-out hover:scale-110"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="dark:bg-[#d5d5d5] bg-[#2a2a2a] dark:text-black text-white font-bold px-4 py-2 rounded-xl transition-all duration-300 ease-in-out hover:scale-110"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center">
        <button
          ref={mobileMenuButtonRef}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            key="mobile-menu"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 right-0 h-screen w-3/4 bg-white dark:bg-[#1e1e1e] shadow-xl z-50 p-8"
          >
            <div className="flex flex-col items-start gap-4">
              <ThemeToggle />
              <hr className="w-full border-gray-200 dark:border-gray-700" />
              {user ? (
                <>
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    Signed in as
                    <br />
                    <span className="font-semibold truncate">
                      {user.email ?? "Loading..."}
                    </span>
                  </div>
                  <hr className="w-full border-gray-200 dark:border-gray-700" />
                  {menuItems.map((item, i) => {
                    if (item.adminOnly && !userProfile?.is_admin) return null;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (item.action === "logout") {
                            handleLogout();
                          } else {
                            router.push(item.href);
                          }
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${item.className} hover:bg-gray-100 dark:hover:bg-[#2a2a2a]`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="dark:text-white text-black font-bold py-2"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="dark:text-white text-black font-bold py-2"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
