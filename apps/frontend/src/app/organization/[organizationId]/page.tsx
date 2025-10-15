"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";

import { Bounce, toast } from "react-toastify";
import { User as UserType } from "@supabase/auth-js";
import { ShieldUser, User, UserMinus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Organization } from "@lib/types";
import { createClient } from "@lib/supabase/client";

const OrganizationManagementPage: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { theme } = useTheme();

  const supabase = createClient();

  const [user, setUser] = useState<UserType | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<
    {
      id: string;
      name: string | null;
      studentId: string | null;
      nickname: string | null;
      email: string;
      role: "admin" | "member";
      joinedAt: string;
    }[]
  >([]);

  const fetchMembers = useCallback(async () => {
    const { data: membersData, error } = await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId);

    if (error) {
      console.error("Error fetching members:", error);
    } else {
      const membersWithProfiles = await Promise.all(
        membersData.map(async (member) => {
          const userId = member.user_id;
          const { data: userProfile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (profileError) {
            console.error("Error fetching user profile:", profileError);
            return null;
          }

          if (userProfile) {
            return {
              id: userId as string,
              name: userProfile.name as string | null,
              studentId: userProfile.student_id as string | null,
              nickname: userProfile.nickname as string | null,
              email: userProfile.email as string,
              role: member.role as "admin" | "member",
              joinedAt: member.joined_at as string,
            };
          }
        }),
      );

      setMembers(
        membersWithProfiles.filter(Boolean) as {
          id: string;
          name: string | null;
          studentId: string | null;
          nickname: string | null;
          email: string;
          role: "admin" | "member";
          joinedAt: string;
        }[],
      );
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Error fetching user:", error);
      } else {
        setUser(user);
      }
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    const fetchOrganization = async () => {
      const { data: organization, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching organization:", error);
      } else if (!organization) {
        console.warn("Organization not found");
      } else {
        setOrganization(organization);
      }
    };

    fetchOrganization();
  }, [supabase, organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const [modal, setModal] = useState<{
    type: "role" | "remove";
    userId: string;
    currentRole?: "admin" | "member";
  } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteQueue, setInviteQueue] = useState<string[]>([]);
  const [inviteResults, setInviteResults] = useState<{
    success: string[];
    already: string[];
    notFound: string[];
  } | null>(null);
  const addInviteToken = useCallback(() => {
    const v = inviteValue.trim();
    if (!v) return;
    setInviteQueue((prev) => {
      const normalizedPrev = prev.map((t) =>
        t.includes("@") ? t.toLowerCase() : t,
      );
      const norm = v.includes("@") ? v.toLowerCase() : v;
      if (normalizedPrev.includes(norm)) return prev; // dedupe
      return [...prev, v];
    });
    setInviteValue("");
  }, [inviteValue]);

  const removeInviteToken = useCallback((idx: number) => {
    setInviteQueue((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleInvite = useCallback(async () => {
    const tokens = Array.from(
      new Set(inviteQueue.map((t) => t.trim()).filter(Boolean)),
    );
    if (tokens.length === 0) return;
    setIsInviting(true);
    try {
      // 2) split by heuristic: with '@' => email, otherwise student_id
      const emailTokens = tokens.filter((t) => t.includes("@"));
      const sidTokens = tokens.filter((t) => !t.includes("@"));

      type Candidate = {
        id: string;
        email: string | null;
        student_id: string | null;
      };
      let candidates: Candidate[] = [];

      if (emailTokens.length) {
        const { data } = await supabase
          .from("users")
          .select("id, email, student_id")
          .in("email", emailTokens);
        if (Array.isArray(data))
          candidates = candidates.concat(data as Candidate[]);
      }
      if (sidTokens.length) {
        const { data } = await supabase
          .from("users")
          .select("id, email, student_id")
          .in("student_id", sidTokens);
        if (Array.isArray(data))
          candidates = candidates.concat(data as Candidate[]);
      }

      // 3) build lookup maps for quick resolution
      const byEmail = new Map<string, string>();
      const bySid = new Map<string, string>();
      for (const c of candidates) {
        if (c.email) byEmail.set(c.email.toLowerCase(), c.id);
        if (c.student_id) bySid.set(String(c.student_id), c.id);
      }

      const tokenToUserId = new Map<string, string>();
      for (const t of tokens) {
        const id = t.includes("@")
          ? byEmail.get(t.toLowerCase())
          : bySid.get(t);
        if (id) tokenToUserId.set(t, id);
      }

      const notFound = tokens.filter((t) => !tokenToUserId.has(t));

      const matchedIds = Array.from(
        new Set(Array.from(tokenToUserId.values())),
      );

      // 4) filter out already members
      let alreadyIdSet = new Set<string>();
      if (matchedIds.length) {
        const { data: existing } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", organizationId)
          .in("user_id", matchedIds);
        if (Array.isArray(existing)) {
          alreadyIdSet = new Set(
            existing.map((r) => String((r as { user_id: string }).user_id)),
          );
        }
      }

      const toInsertIds = matchedIds.filter((id) => !alreadyIdSet.has(id));
      if (toInsertIds.length) {
        const rows = toInsertIds.map((id) => ({
          organization_id: organizationId,
          user_id: id,
          role: "member",
        }));
        const { error: insertErr } = await supabase
          .from("organization_members")
          .insert(rows);
        if (insertErr) {
          console.error(insertErr);
          toast.error("일부 초대에 실패했습니다.", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            theme: theme === "dark" ? "dark" : "light",
            transition: Bounce,
          });
        }
      }

      // 5) build feedback lists based on original tokens
      const successTokens = tokens.filter((t) => {
        const id = tokenToUserId.get(t);
        return id ? toInsertIds.includes(id) : false;
      });
      const alreadyTokens = tokens.filter((t) => {
        const id = tokenToUserId.get(t);
        return id ? alreadyIdSet.has(id) : false;
      });

      setInviteResults({
        success: successTokens,
        already: alreadyTokens,
        notFound,
      });

      toast.success(`초대 완료: ${successTokens.length}명`, {
        position: "top-right",
        autoClose: 1800,
        hideProgressBar: true,
        closeOnClick: true,
        theme: theme === "dark" ? "dark" : "light",
        transition: Bounce,
      });

      // refresh members list
      await fetchMembers();
    } finally {
      setIsInviting(false);
    }
  }, [inviteQueue, supabase, organizationId, theme, fetchMembers]);

  const handleConfirm = useCallback(async () => {
    if (!modal) return;

    if (modal.type === "remove") {
      await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", modal.userId)
        .eq("organization_id", organizationId);
      toast.success("정상적으로 유저를 삭제했습니다.", {
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
    } else if (modal.type === "role") {
      const newRole = modal.currentRole === "admin" ? "member" : "admin";
      await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("user_id", modal.userId)
        .eq("organization_id", organizationId);
      toast.success(
        `정상적으로 ${newRole === "admin" ? "관리자" : "일반 멤버"}로 변경했습니다.`,
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: theme === "dark" ? "dark" : "light",
          transition: Bounce,
        },
      );
    }

    setModal(null);
    fetchMembers();
  }, [modal, organizationId, supabase, theme, fetchMembers]);

  if (!organization) {
    return (
      <div className="p-4 text-center text-gray-500">
        조직 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8">
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
                  member?.name,
                  member?.studentId,
                  member?.nickname,
                  member?.email,
                  member?.role,
                  new Date(member?.joinedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  }),
                ].map((v, i) => (
                  <td key={i} className="p-2 text-center truncate">
                    {i === 4 ? (
                      <div className="flex items-center justify-center gap-1">
                        {v === "admin" ? (
                          <>
                            <ShieldUser className="h-4 w-4 text-blue-500" />
                            <span>관리자</span>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 text-gray-500" />
                            <span>멤버</span>
                          </>
                        )}
                      </div>
                    ) : (
                      v || "─"
                    )}
                  </td>
                ))}
                {member.id !== user!.id &&
                  member.id !== organization.created_by && (
                    <td className="p-2 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          setModal({
                            type: "remove",
                            userId: member!.id,
                          })
                        }
                      >
                        <UserMinus className="w-6 h-auto bg-red-400 p-1 rounded-md text-white dark:text-black hover:cursor-pointer" />
                      </button>
                      {member.role === "admin" ? (
                        <button
                          onClick={() =>
                            setModal({
                              type: "role",
                              userId: member.id,
                              currentRole: "admin",
                            })
                          }
                        >
                          <User className="w-6 h-auto bg-green-400 p-1 rounded-md text-white dark:text-black hover:cursor-pointer" />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setModal({
                              type: "role",
                              userId: member.id,
                              currentRole: "member",
                            })
                          }
                        >
                          <ShieldUser className="w-6 h-auto bg-blue-400 p-1 rounded-md text-white dark:text-black hover:cursor-pointer" />
                        </button>
                      )}
                    </td>
                  )}
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
        <div className="w-full flex justify-end">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors hover:cursor-pointer"
            onClick={() => setInviteModalOpen(true)}
          >
            추가
          </button>
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-brightness-75 backdrop-blur-sm"
            onClick={() => setModal(null)}
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
                {modal.type === "remove"
                  ? "정말로 해당 사용자를 삭제하시겠습니까?"
                  : modal.currentRole === "admin"
                    ? "관리자를 일반 멤버로 변경하시겠습니까?"
                    : "일반 멤버를 관리자 권한으로 변경하시겠습니까?"}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {inviteModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-brightness-75 backdrop-blur-sm"
            onClick={() => setInviteModalOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <h2 className="text-lg font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
                유저 초대
              </h2>
              <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-300">
                  이메일 또는 학번
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteValue}
                    onChange={(e) => setInviteValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addInviteToken();
                      }
                    }}
                    placeholder="예: user@example.com 또는 20231234"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addInviteToken}
                    className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                  >
                    추가
                  </button>
                </div>
                {inviteQueue.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {inviteQueue.map((t, idx) => (
                      <span
                        key={`${t}-${idx}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-black dark:text-white text-sm"
                      >
                        <span className="truncate max-w-[200px]" title={t}>
                          {t}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeInviteToken(idx)}
                          className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          aria-label="remove"
                          title="삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  한 명씩 추가 버튼으로 리스트에 담아 초대할 수 있어요.
                </p>
              </div>

              {inviteResults && (
                <div className="mt-4 space-y-3">
                  {inviteResults.success.length > 0 && (
                    <div className="rounded-md border border-green-400/40 bg-green-50 dark:bg-green-900/20 p-3">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        초대 성공 ({inviteResults.success.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {inviteResults.success.map((t) => (
                          <span
                            key={`s-${t}`}
                            className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {inviteResults.already.length > 0 && (
                    <div className="rounded-md border border-blue-400/40 bg-blue-50 dark:bg-blue-900/20 p-3">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        이미 멤버 ({inviteResults.already.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {inviteResults.already.map((t) => (
                          <span
                            key={`a-${t}`}
                            className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {inviteResults.notFound.length > 0 && (
                    <div className="rounded-md border border-red-400/40 bg-red-50 dark:bg-red-900/20 p-3">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        찾을 수 없음 ({inviteResults.notFound.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {inviteResults.notFound.map((t) => (
                          <span
                            key={`n-${t}`}
                            className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-between gap-2">
                <button
                  onClick={() => {
                    setInviteResults(null);
                    setInviteQueue([]);
                    setInviteValue("");
                  }}
                  className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  초기화
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => void handleInvite()}
                    disabled={inviteQueue.length === 0 || isInviting}
                    className={`px-4 py-2 rounded text-white ${
                      inviteQueue.length === 0 || isInviting
                        ? "bg-blue-400/50 cursor-not-allowed"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {isInviting ? "초대 중..." : "초대"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrganizationManagementPage;
