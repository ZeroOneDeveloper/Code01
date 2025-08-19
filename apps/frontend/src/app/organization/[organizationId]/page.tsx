"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";

import { Bounce, toast } from "react-toastify";
import { User as UserType } from "@supabase/auth-js";
import { Check, ShieldUser, User, UserMinus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Organization, UserProfile } from "@lib/types";
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
  const [users, setUsers] = useState<Array<UserProfile>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

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

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: usersData, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
      } else {
        const memberIds = new Set(members.map((m) => m.id));
        const nonMemberUsers = (usersData || []).filter(
          (u) => !memberIds.has(u.id),
        );
        setUsers(nonMemberUsers);
      }
    };

    fetchUsers();
  }, [supabase, members]);

  const [modal, setModal] = useState<{
    type: "role" | "remove";
    userId: string;
    currentRole?: "admin" | "member";
  } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

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
            초대
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
              <table className="w-full table-auto border-collapse text-sm text-center">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">이름</th>
                    <th className="p-2">학번</th>
                    <th className="p-2">이메일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`border-b cursor-pointer transition-colors ${
                        selectedUserIds.has(user.id)
                          ? "bg-blue-100 dark:bg-blue-800"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <td className="p-2 flex items-center justify-center gap-2">
                        <div className="relative w-4 h-4">
                          <AnimatePresence>
                            {selectedUserIds.has(user.id) && (
                              <motion.div
                                key="check"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 30,
                                }}
                                className="absolute"
                              >
                                <Check className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <span>{user.name || "─"}</span>
                      </td>
                      <td className="p-2">{user.student_id || "─"}</td>
                      <td className="p-2">{user.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 flex justify-end gap-2">
                {selectedUserIds.size > 0 && (
                  <button
                    onClick={async () => {
                      for (const userId of selectedUserIds) {
                        await supabase.from("organization_members").insert({
                          organization_id: organizationId,
                          user_id: userId,
                          role: "member",
                        });
                      }
                      toast.success(
                        `선택한 ${selectedUserIds.size}명을 유저를 초대했습니다.`,
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
                      setInviteModalOpen(false);
                      setSelectedUserIds(new Set());
                      fetchMembers();
                    }}
                    className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                    disabled={selectedUserIds.size === 0}
                  >
                    초대
                  </button>
                )}
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrganizationManagementPage;
