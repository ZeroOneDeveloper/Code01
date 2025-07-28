import React from "react";

import { User, Lock, LockOpen, CirclePlus, Calendar } from "lucide-react";
import Link from "next/link";

const OrganizationCard: React.FC<{
  organization?: {
    id: string;
    name: string;
    is_private: boolean;
    created_by: string;
    created_at: string;
  };
  organizationMemberCount?: number;
}> = ({ organization, organizationMemberCount }) => {
  if (!organization) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg transition hover:scale-105 cursor-pointer flex items-center justify-center">
        <CirclePlus className="w-12 h-auto" />
      </div>
    );
  }
  return (
    <Link
      href={`/organization/${organization.id}`}
      className="flex flex-col gap-4 border border-gray-300 px-6 py-4 rounded-lg shadow-md transition hover:scale-105 cursor-pointer"
    >
      <h1 className="text-left text-xl font-bold truncate">
        {organization.name}
      </h1>
      <div className="flex items-center gap-2">
        <User className="w-8 h-auto" />
        <h1 className="text-xl font-bold">{organizationMemberCount}</h1>
      </div>
      {organization.is_private ? (
        <div className="flex items-center gap-2">
          <Lock className="w-8 h-auto" />
          <h1 className="text-xl font-bold">비공개 조직</h1>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <LockOpen className="w-8 h-auto" />
          <h1 className="text-xl font-bold">공개 조</h1>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Calendar className="w-8 h-auto" />
        <h1 className="text-xl font-bold">
          {new Date(organization.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })}
        </h1>
      </div>
    </Link>
  );
};

export default OrganizationCard;
