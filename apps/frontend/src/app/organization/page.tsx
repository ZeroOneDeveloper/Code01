import React from "react";

import { createClient } from "@lib/supabase/server";
import OrganizationCard from "@components/OrganizationCard";

const OrganizationPage = async () => {
  const supabase = await createClient();

  const user = (await supabase.auth.getUser()).data.user;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  const adminOrgIds = adminOrgs?.map((m) => m.organization_id) ?? [];

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("*")
    .or(
      [
        `created_by.eq.${user.id}`,
        adminOrgIds.length > 0
          ? `id.in.(${adminOrgIds.map((id) => `"${id}"`).join(",")})`
          : null,
      ]
        .filter(Boolean)
        .join(","),
    );

  if (error) {
    console.error(error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col gap-4 md:w-1/2">
          <h1 className="text-left text-4xl font-bold">Error</h1>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  const orgsWithCounts = await Promise.all(
    (organizations ?? []).map(async (org) => {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      return { org, count: count ?? 0 };
    }),
  );

  return (
    <div className="min-h-screen flex items-center justify-center py-44">
      <div className="flex flex-col gap-8 md:w-1/2">
        <div className="flex flex-col gap-2 ">
          <h1 className="text-left text-4xl font-bold">Organizations</h1>
          <hr className="border-gray-200 dark:border-gray-700" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {orgsWithCounts.map(({ org, count }) => (
            <OrganizationCard
              key={org.id}
              organization={org}
              organizationMemberCount={count}
            />
          ))}
          <OrganizationCard />
        </div>
      </div>
    </div>
  );
};

export default OrganizationPage;
