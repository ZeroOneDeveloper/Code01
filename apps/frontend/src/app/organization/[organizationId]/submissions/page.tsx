"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { formatMemoryKb } from "@lib/format-memory";
import { createClient } from "@lib/supabase/client";
import { Problem, Submission, toStatusKo } from "@lib/types";

type StatusFilter =
  | "all"
  | "accepted"
  | "wrong"
  | "tle"
  | "mle"
  | "ce"
  | "re"
  | "pending";

type UserNick = { id: string; nickname: string | null };

const SubmissionsPage: React.FC = () => {
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const orgId = params?.organizationId ? Number(params.organizationId) : NaN;

  const supabase = useMemo(() => createClient(), []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Pick<Problem, "id" | "title">[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Filters (preload from query if present)
  const [selectedProblemId, setSelectedProblemId] = useState<number | "all">(
    searchParams.get("problemId")
      ? Number(searchParams.get("problemId"))
      : "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Load current user id
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  // Load problems for this organization
  useEffect(() => {
    if (!orgId || Number.isNaN(orgId)) return;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("problems")
        .select("id, title")
        .eq("organization_id", orgId)
        .order("id", { ascending: true });
      if (error) {
        setError("문제 목록을 불러오는 중 오류가 발생했습니다.");
        setProblems([]);
        setLoading(false);
        return;
      }
      setProblems((data ?? []) as Pick<Problem, "id" | "title">[]);
      setLoading(false);
    })();
  }, [orgId, supabase]);

  // Load submissions based on filters
  useEffect(() => {
    const loadSubmissions = async () => {
      if (!orgId || Number.isNaN(orgId)) return;
      setLoading(true);
      setError(null);

      // Determine problem ids to query
      const problemIds = (
        selectedProblemId === "all"
          ? problems.map((p) => p.id)
          : [Number(selectedProblemId)]
      ).filter((x) => !Number.isNaN(x));

      if (problemIds.length === 0) {
        setSubmissions([]);
        setNicknames({});
        setLoading(false);
        return;
      }

      const query = supabase
        .from("problem_submissions")
        .select("*")
        .in("problem_id", problemIds)
        .order("submitted_at", { ascending: false });

      const { data, error } = await query;
      if (error) {
        setError("제출 기록을 불러오는 중 오류가 발생했습니다.");
        setSubmissions([]);
        setNicknames({});
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Submission[];

      // Client-side status filter (best effort; 프로젝트 정의에 맞게 조정 가능)
      const filtered = rows.filter((s) => {
        switch (statusFilter) {
          case "accepted":
            return s.is_correct;
          case "wrong":
            return !s.is_correct && String(s.status_code) !== "0";
          case "tle":
            return !s.passed_time_limit;
          case "mle":
            return !s.passed_memory_limit;
          case "ce":
            return (
              String(s.status_code).includes("Compilation") ||
              String(s.status_code) === "6"
            );
          case "re":
            return (
              String(s.status_code).includes("Runtime") ||
              String(s.status_code) === "5"
            );
          case "pending":
            return (
              String(s.status_code).includes("Pending") ||
              String(s.status_code) === "0"
            );
          default:
            return true;
        }
      });

      setSubmissions(filtered);

      // Load user nicknames for the visible rows
      const userIds = Array.from(new Set(filtered.map((s) => s.user_id)));
      if (userIds.length) {
        const { data: users, error: userErr } = await supabase
          .from("users")
          .select("id, nickname")
          .in("id", userIds);
        if (!userErr && users) {
          const userList = users as UserNick[];
          setNicknames(
            Object.fromEntries(userList.map((u) => [u.id, u.nickname ?? ""])),
          );
        }
      } else {
        setNicknames({});
      }

      setLoading(false);
    };

    loadSubmissions();
  }, [
    orgId,
    problems,
    selectedProblemId,
    statusFilter,
    currentUserId,
    supabase,
    refreshTick,
  ]);

  useEffect(() => {
    if (!orgId || Number.isNaN(orgId)) return;

    const channel = supabase
      .channel(`problem_submissions:org:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "problem_submissions",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Submission | null;

          // If a specific problem is selected, ignore changes for other problems
          if (
            selectedProblemId !== "all" &&
            row &&
            row.problem_id !== Number(selectedProblemId)
          ) {
            return;
          }

          setRefreshTick((t) => t + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, selectedProblemId, supabase]);

  const problemTitleById = useMemo(() => {
    const map = new Map<number, string>();
    problems.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [problems]);

  const total = submissions.length;
  const accepted = submissions.filter((s) => s.is_correct).length;
  const acceptedRate =
    total > 0 ? `${((accepted / total) * 100).toFixed(1)}%` : "-";

  const statusBadgeClass = (statusCode: number | string) => {
    const code = Number(statusCode);
    if (code === 1) return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
    if (code === 2) return "border-amber-500/50 bg-amber-500/15 text-amber-300";
    if (code === 3 || code === 4)
      return "border-orange-500/50 bg-orange-500/15 text-orange-300";
    if (code === 5 || code === 6) return "border-rose-500/50 bg-rose-500/15 text-rose-300";
    return "border-gray-600 bg-gray-700/30 text-gray-300";
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 px-2 md:px-0">
      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">조직 제출 기록</h1>
            <p className="mt-1 text-sm text-gray-400">
              문제별 제출 현황과 채점 결과를 확인합니다.
            </p>
          </div>
          {!isNaN(orgId) && (
            <Link
              href={`/organization/${orgId}/problems`}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
            >
              문제 관리로 이동
            </Link>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">총 제출</p>
            <p className="text-base font-semibold text-gray-100">{total}</p>
          </div>
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">정답</p>
            <p className="text-base font-semibold text-gray-100">{accepted}</p>
          </div>
          <div className="rounded-md border border-gray-700 bg-[#121723] px-3 py-2">
            <p className="text-xs text-gray-400">정답률</p>
            <p className="text-base font-semibold text-gray-100">{acceptedRate}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-700 bg-[#181b24] p-4 md:p-5 space-y-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-gray-400">문제</label>
            <select
              className="rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-sm text-gray-100"
              value={selectedProblemId === "all" ? "all" : String(selectedProblemId)}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedProblemId(v === "all" ? "all" : Number(v));
              }}
            >
              <option value="all">전체 문제</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || `Problem #${p.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-gray-400">상태</label>
            <select
              className="rounded-md border border-gray-600 bg-[#10141e] px-3 py-2 text-sm text-gray-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">전체</option>
              <option value="accepted">정답</option>
              <option value="wrong">오답</option>
              <option value="tle">시간 초과</option>
              <option value="mle">메모리 초과</option>
              <option value="ce">컴파일 에러</option>
              <option value="re">런타임 에러</option>
              <option value="pending">대기중</option>
            </select>
          </div>
          <div className="text-xs text-gray-400 lg:text-right">
            최근 갱신: {new Date().toLocaleTimeString("ko-KR")}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full min-w-[1040px] table-fixed text-sm">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="border-b border-gray-700 bg-[#222736]">
              <tr>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  제출 번호
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  문제
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  사용자
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  결과
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  시간
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  메모리
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  케이스
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  코드
                </th>
                <th className="px-3 py-2 text-center font-semibold text-gray-100">
                  제출시각
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-rose-400">
                    {error}
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400">
                    제출 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                submissions.map((s) => {
                  const problemTitle =
                    problemTitleById.get(s.problem_id) || `Problem #${s.problem_id}`;
                  return (
                    <tr key={s.id} className="hover:bg-[#202635]">
                      <td className="px-3 py-2 text-center text-gray-200">{s.id}</td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          className="inline-block max-w-[200px] truncate text-gray-100 hover:text-teal-300"
                          href={`/problem/${s.problem_id}`}
                          title={problemTitle}
                        >
                          {problemTitle}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-300">
                        {nicknames[s.user_id] || s.user_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${statusBadgeClass(
                            s.status_code,
                          )}`}
                        >
                          {toStatusKo(s.status_code)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-200">
                        {s.time_ms ?? "-"} ms
                      </td>
                      <td className="px-3 py-2 text-center text-gray-200">
                        {formatMemoryKb(s.memory_kb)}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-200">
                        {s.cases_done ?? 0}/{s.cases_total ?? 0}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link
                          href={`/problem/${s.problem_id}/submissions/${s.id}`}
                          className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700/40"
                        >
                          조회
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-300">
                        {new Date(s.submitted_at).toLocaleString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SubmissionsPage;
