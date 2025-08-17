"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { Submission, toStatusKo } from "@lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@lib/supabase/client";

const labels = [
  "제출 번호",
  "아이디",
  "결과",
  "메모리",
  "시간",
  "코드",
  "코드 길이",
  "제출한 시간",
];

// DB row shape including transient judge fields delivered via realtime/polling
type SubmissionRow = Submission & {
  cases_done?: number | null;
  cases_total?: number | null;
  status_code?: number | null;
  memory_kb?: number | null;
  time_ms?: number | null;
};

const SubmissionsPage: React.FC = () => {
  const params = useParams<{ problemId: string }>();
  const searchParams = useSearchParams();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pendingParam =
    searchParams.get("pending_id") ?? searchParams.get("pendingId") ?? null;
  const pendingIdNum = pendingParam ? Number(pendingParam) : null;

  // Derive stable keys from URL params for effect deps
  const onlyMine = searchParams.get("user_id") === "true";
  const searchKey = searchParams.toString();

  // Helper to pull the latest single submission row by id and merge into state
  const refreshSubmissionById = async (id: number) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("problem_submissions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.debug("[Realtime][pull] error", error);
        return;
      }
      if (data) {
        setSubmissions((prev) =>
          prev.map((s) =>
            Number(s.id) === Number(data.id) ? { ...s, ...data } : s,
          ),
        );
      }
    } catch (e) {
      console.debug("[Realtime][pull] exception", e);
    }
  };

  useEffect(() => {
    const fetchSubmissions = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      let query = supabase
        .from("problem_submissions")
        .select("*")
        .eq("problem_id", params.problemId)
        .order("submitted_at", { ascending: false });

      if (onlyMine && user?.id) {
        query = query.eq("user_id", user.id);
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
  }, [params.problemId, searchKey, onlyMine]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (pendingIdNum !== null) {
      channel = supabase.channel(`submission-progress-${pendingIdNum}`).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "problem_submissions",
          filter: `id=eq.${pendingIdNum}`,
        },
        (payload: RealtimePostgresChangesPayload<SubmissionRow>) => {
          console.debug("[Realtime] payload", payload);
          const row = (payload.new ?? payload.old) as SubmissionRow;
          setSubmissions((prev) =>
            prev.map((s) =>
              Number(s.id) === Number(row.id) ? { ...s, ...row } : s,
            ),
          );
          // Pull the freshest row to avoid missing partial fields in payload
          refreshSubmissionById(Number(row.id));
        },
      );
      console.debug(
        "[Realtime] subscribing channel",
        `submission-progress-${pendingIdNum}`,
      );
      channel.subscribe();
    }

    return () => {
      if (channel) {
        console.debug(
          "[Realtime] unsubscribe",
          `submission-progress-${pendingIdNum}`,
        );
        supabase.removeChannel(channel);
      }
    };
  }, [pendingIdNum]);

  // Fallback polling while pending row is active
  useEffect(() => {
    if (pendingIdNum === null) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      await refreshSubmissionById(pendingIdNum);
      // stop automatically if the pending row is complete (cd >= ct) or not present
      const s = submissions.find((x) => Number(x.id) === pendingIdNum);
      const cd = s?.cases_done ?? undefined;
      const ct = s?.cases_total ?? undefined;
      if (
        typeof cd === "number" &&
        typeof ct === "number" &&
        ct > 0 &&
        cd >= ct
      ) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };

    // Start a gentle fallback poll (e.g., 1s) until complete
    timer = setInterval(tick, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pendingIdNum, submissions]);

  return (
    <div className="p-4">
      <table className="w-full table-auto border-collapse text-sm text-center">
        <thead>
          <tr className="border-b">
            {labels.map((header, i) => (
              <th key={i} className="p-2 text-center">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map((s, idx) => (
            <tr key={idx} className="border-b">
              {(() => {
                const cd = s.cases_done ?? undefined;
                const ct = s.cases_total ?? undefined;
                const isPendingRow =
                  pendingIdNum !== null ? Number(s.id) === pendingIdNum : false;

                const statusCode = s.status_code;
                let resultText: string = toStatusKo(statusCode);
                if (isPendingRow) {
                  let pct = 0;
                  if (
                    typeof cd === "number" &&
                    typeof ct === "number" &&
                    ct > 0
                  ) {
                    pct = Math.floor((cd / ct) * 100);
                    if (cd >= ct) {
                      pct = 100; // 모든 케이스 완료
                    } else if (pct > 99) {
                      pct = 99; // 진행 중인 동안은 최대 99%
                    }
                  }
                  resultText =
                    cd !== undefined && ct !== undefined && ct > 0 && cd >= ct
                      ? `${toStatusKo(statusCode)} (${pct}%)`
                      : `진행중 (${pct}%)`;
                }

                return [
                  s.id,
                  nicknames[s.user_id] || "Unknown User",
                  resultText,
                  `${s.memory_kb ?? "-"} KB`,
                  `${s.time_ms ?? "-"} ms`,
                  s.user_id === currentUserId ? (
                    ["조회", `/problem/${s.problem_id}/submissions/${s.id}`]
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                      title="내 제출물만 열람 가능합니다."
                    >
                      <span aria-hidden>🔒</span>
                      <span>열람 제한</span>
                      <span className="sr-only">
                        내 제출물만 열람 가능합니다.
                      </span>
                    </span>
                  ),
                  `${s.code.length} 자`,
                  new Date(s.submitted_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  }),
                ];
              })().map((v, i) => (
                <td key={i} className="p-2 text-center">
                  {Array.isArray(v) ? (
                    <Link
                      href={v[1]}
                      className="font-semibold cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {v[0]}
                    </Link>
                  ) : React.isValidElement(v) ? (
                    v
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
          {submissions.length === 0 && (
            <tr>
              <td
                colSpan={labels.length}
                className="p-4 text-center text-gray-500"
              >
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
