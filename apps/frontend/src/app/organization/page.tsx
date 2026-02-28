import React from "react";
import Link from "next/link";
import { ArrowRight, Lock, Users } from "lucide-react";

import { createClient } from "@lib/supabase/server";
import CreateOrganizationButton from "@components/CreateOrganizationButton";

type OrganizationRow = {
  id: number;
  name: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
};

const OrganizationPage = async () => {
  const supabase = await createClient();

  const user = (await supabase.auth.getUser()).data.user;

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-4 md:w-1/2">
          <h1 className="text-left text-4xl font-bold">Unauthorized</h1>
          <p>You must be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  const { data: adminOrgs } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "admin");

  const adminOrgIds: number[] = (adminOrgs ?? []).map(
    (m: { organization_id: number }) => m.organization_id,
  );

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("*")
    .or(
      [
        `created_by.eq.${user.id}`,
        adminOrgIds.length > 0
          ? `id.in.(${adminOrgIds.map((id: number) => `"${id}"`).join(",")})`
          : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-4 md:w-1/2">
          <h1 className="text-left text-4xl font-bold">Error</h1>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  const orgsWithCounts = await Promise.all(
    ((organizations ?? []) as OrganizationRow[]).map(async (org) => {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);

      const isAdmin = org.created_by === user.id || adminOrgIds.includes(org.id);

      return {
        org,
        count: count ?? 0,
        roleLabel: isAdmin ? "관리자" : "멤버",
      };
    }),
  );

  return (
    <div className="w-full flex justify-center pt-8 pb-8">
      <div className="w-full max-w-5xl px-4 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-gray-700/70 pb-3">
          <div>
            <h1 className="text-left text-4xl font-bold">Organizations</h1>
            <p className="mt-1 text-sm text-gray-400">
              내가 관리하거나 참여한 조직 목록입니다.
            </p>
          </div>
          <CreateOrganizationButton />
        </div>

        {orgsWithCounts.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-[#1c1f27] px-6 py-12 text-center text-gray-400">
            아직 접근 가능한 organization이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700 bg-[#1c1f27]">
            <table className="table-fixed w-full min-w-[860px]">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-[#222736]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-100">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-100">
                    공개
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-100">
                    인원
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-100">
                    내 권한
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-100">
                    생성일
                  </th>
                </tr>
              </thead>
              <tbody>
                {orgsWithCounts.map(({ org, count, roleLabel }) => (
                  <tr
                    key={org.id}
                    className="border-t border-gray-700/70 hover:bg-[#252b3b] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/organization/${org.id}`}
                        className="group inline-flex items-center gap-2 text-base font-semibold text-gray-100 hover:text-teal-300"
                      >
                        <span className="max-w-[420px] truncate">{org.name}</span>
                        {org.is_private && (
                          <Lock
                            className="h-4 w-4 text-gray-400"
                            aria-label="비공개 조직"
                          />
                        )}
                        <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {org.is_private ? "비공개" : "공개"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-100">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        {count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 ${
                          roleLabel === "관리자"
                            ? "border-teal-500/70 bg-teal-500/15 text-teal-300"
                            : "border-gray-600 bg-gray-700/30 text-gray-200"
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(org.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationPage;
