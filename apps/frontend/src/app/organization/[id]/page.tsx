import React from "react";

import { ShieldUser, User } from "lucide-react";

import { createClient } from "@lib/supabase/server";

const OrganizationManagementPage: React.FC<{
  params: Promise<{ id: string }>;
}> = async ({ params }) => {
  const supabase = await createClient();

  const { id } = await params;

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const members = await Promise.all(
    (
      await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", id)
    ).data!.map(async (member) => {
      const userId = member.user_id;
      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      console.log(userProfile);
      if (userProfile) {
        return {
          id: userId,
          name: userProfile.name,
          studentId: userProfile.student_id,
          nickname: userProfile.nickname,
          email: userProfile.email,
          role: member.role,
          joinedAt: member.joined_at,
        };
      }
    }),
  );

  return (
    <table className="w-full table-auto border-collapse text-sm text-center">
      <thead>
        <tr className="border-b">
          {["이름", "학번", "닉네임", "이메일", "역할", "가입 시간"].map(
            (header, i) => (
              <th key={i} className="p-2 text-center">
                {header}
              </th>
            ),
          )}
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
                  <>
                    {v === "admin" ? (
                      <div className="flex items-center justify-center gap-1">
                        <ShieldUser className="h-4 w-4 text-blue-500" />
                        <span>관리자</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span>멤버</span>
                      </div>
                    )}
                  </>
                ) : (
                  v || "─"
                )}
              </td>
            ))}
          </tr>
        ))}
        {/*{submissions.length === 0 && (*/}
        {/*  <tr>*/}
        {/*    <td colSpan={7} className="p-4 text-center text-gray-500">*/}
        {/*      제출이 없습니다.*/}
        {/*    </td>*/}
        {/*  </tr>*/}
        {/*)}*/}
      </tbody>
    </table>
  );
};

export default OrganizationManagementPage;
