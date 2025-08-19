import React from "react";
import { redirect } from "next/navigation";

import { createClient } from "@lib/supabase/server";
import OrganizationTabs from "@components/OrganizationTabs";

export default async function OrganizationManagementLayout({
  params,
  children,
}: Readonly<{
  params: Promise<{ organizationId: string }>;
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const { organizationId } = await params;

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !organization) {
    console.error("Error fetching organization:", error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-bold">조직을 찾을 수 없습니다.</h1>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-bold">조직에 가입되어 있지 않습니다.</h1>
      </div>
    );
  }

  if (member.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-bold">조직 관리 권한이 없습니다.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-44">
      <div className="flex flex-col gap-8 md:w-1/2">
        <div className="flex flex-col gap-2 ">
          <h1 className="text-left text-4xl font-bold">{organization.name}</h1>
          <OrganizationTabs />
          <hr className="border-gray-200 dark:border-gray-700" />
        </div>
        {children}
      </div>
    </div>
  );
}
