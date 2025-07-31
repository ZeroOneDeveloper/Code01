"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { Submission } from "@lib/types";
import { createClient } from "@lib/supabase/client";

const SubmissionsPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSubmissions = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("problem_submissions")
        .select("*")
        .eq("problem_id", params.id)
        .order("submitted_at", { ascending: false });

      if (searchParams.get("user_id") == "true") {
        query = query.eq("user_id", user?.id);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching submissions:", error);
      } else {
        const userIds = data.map((s) => s.user_id);
        const { data: userProfiles, error: userError } = await supabase
          .from("users")
          .select("id, nickname")
          .in("id", userIds);
        if (userError) {
          console.error("Error fetching user nicknames:", userError);
        }
        setNicknames(
          Object.fromEntries(
            userProfiles?.map((user) => [user.id, user.nickname]) || [],
          ),
        );
        setSubmissions(
          data.filter(
            (s) =>
              s.visibility === "public" ||
              (s.visibility === "correct" && s.is_correct) ||
              s.user_id === user?.id,
          ),
        );
      }
    };

    fetchSubmissions();
  }, [searchParams, params.id]);

  return (
    <div className="p-4">
      <table className="w-full table-auto border-collapse text-sm text-center">
        <thead>
          <tr className="border-b">
            {[
              "제출 번호",
              "아이디",
              "결과",
              "메모리",
              "시간",
              "코드",
              "코드 길이",
              "제출한 시간",
            ].map((header, i) => (
              <th key={i} className="p-2 text-center">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map((s, idx) => (
            <tr key={idx} className="border-b">
              {[
                s.id,
                nicknames[s.user_id] || "Unknown User",
                s.status_code,
                `${s.memory_kb} KB`,
                `${s.time_ms} ms`,
                ["조회", `/problem/${s.problem_id}/submission/${s.id}`],
                `${s.code.length} 자`,
                new Date(s.submitted_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                }),
              ].map((v, i) => (
                <td key={i} className="p-2 text-center">
                  {typeof v === "object" ? (
                    <Link
                      href={v[1]}
                      className="font-semibold cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {v[0]}
                    </Link>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
          {submissions.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-gray-500">
                제출이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SubmissionsPage;
