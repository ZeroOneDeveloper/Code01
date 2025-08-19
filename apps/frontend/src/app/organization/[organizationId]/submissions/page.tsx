"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

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

  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Pick<Problem, "id" | "title">[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  ]);

  const problemTitleById = useMemo(() => {
    const map = new Map<number, string>();
    problems.forEach((p) => map.set(p.id, p.title));
    return map;
  }, [problems]);

  const total = submissions.length;
  const accepted = submissions.filter((s) => s.is_correct).length;

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">조직 제출 기록</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNaN(orgId) && (
            <Link
              href={`/organization/${orgId}/problems`}
              className="text-sm underline underline-offset-4"
            >
              문제 관리로 이동
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col">
          <label className="text-sm text-muted-foreground mb-1">문제</label>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={
              selectedProblemId === "all" ? "all" : String(selectedProblemId)
            }
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
          <label className="text-sm text-muted-foreground mb-1">상태</label>
          <select
            className="rounded-md border px-2 py-1 text-sm"
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
        <div className="flex items-end">
          <div className="text-sm text-muted-foreground">
            총 <span className="font-medium text-foreground">{total}</span>건 ·
            정답 <span className="font-medium text-foreground">{accepted}</span>
            건
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-center tabular-nums">제출 번호</th>
              <th className="p-2 text-center">문제</th>
              <th className="p-2 text-center">사용자</th>
              <th className="p-2 text-center">결과</th>
              <th className="p-2 text-center tabular-nums whitespace-nowrap">
                시간
              </th>
              <th className="p-2 text-center tabular-nums whitespace-nowrap">
                메모리
              </th>
              <th className="p-2 text-center tabular-nums">케이스</th>
              <th className="p-2 text-center">코드</th>
              <th className="p-2 text-center whitespace-nowrap">제출시각</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-4 text-center text-muted-foreground"
                >
                  불러오는 중...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-rose-600">
                  {error}
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-muted-foreground"
                >
                  제출 기록이 없습니다.
                </td>
              </tr>
            ) : (
              submissions.map((s) => {
                const problemTitle =
                  problemTitleById.get(s.problem_id) ||
                  `Problem #${s.problem_id}`;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2 tabular-nums text-center">{s.id}</td>
                    <td className="p-2 text-center">
                      <Link
                        className="underline underline-offset-4 inline-block max-w-[14rem] truncate align-middle"
                        href={`/problem/${s.problem_id}`}
                      >
                        {problemTitle}
                      </Link>
                    </td>
                    <td className="p-2 text-center">
                      {nicknames[s.user_id] || s.user_id.slice(0, 8)}
                    </td>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                        {toStatusKo(s.status_code)}
                      </span>
                    </td>
                    <td className="p-2 tabular-nums text-center whitespace-nowrap">
                      {s.time_ms ?? "-"} ms
                    </td>
                    <td className="p-2 tabular-nums text-center whitespace-nowrap">
                      {s.memory_kb ?? "-"} KB
                    </td>
                    <td className="p-2 tabular-nums text-center">
                      {s.cases_done ?? 0}/{s.cases_total ?? 0}
                    </td>
                    <td className="p-2 text-center">
                      <Link
                        href={`/problem/${s.problem_id}/submissions/${s.id}`}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        조회
                      </Link>
                    </td>
                    <td className="p-2 text-center text-muted-foreground whitespace-nowrap">
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
    </div>
  );
};

export default SubmissionsPage;
