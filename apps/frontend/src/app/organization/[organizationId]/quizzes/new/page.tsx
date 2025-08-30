"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@lib/supabase/client";
import { toast } from "react-toastify";
import Link from "next/link";

type ProblemRow = {
  id: number;
  title: string;
  description: string | null;
  organization_id: number;
  deadline?: string | null;
};

// 출제 방식: 전원 같은 1문제 / 응시마다 무작위 1문제
//  - one_for_all: 퀴즈에 지정된 단일 문제(global_problem_id)만 출제
//  - one_per_attempt: 선택된 문제들 중 응시 시점에 1개 무작위로 배정
type AssignmentMode = "one_for_all" | "one_per_attempt";

export default function NewQuizPage() {
  const { organizationId } = useParams<{ organizationId: string }>(); // organization id
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 시간/출제 설정
  const [timeLimitMin, setTimeLimitMin] = useState<number>(30); // 제한 시간(분)
  const [startLocal, setStartLocal] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5); // 기본: 5분 뒤 시작
    return toLocalDatetimeValue(d);
  });
  const [endLocal, setEndLocal] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // 기본: 7일 뒤 마감
    return toLocalDatetimeValue(d);
  });
  const [publishedLocal, setPublishedLocal] = useState<string>(""); // 비공개 기본
  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("one_per_attempt");

  useEffect(() => {
    const run = async () => {
      try {
        if (!organizationId) return;
        const orgIdNum = Number(organizationId);
        const { data, error } = await supabase
          .from("problems")
          .select("id, title, description, organization_id, deadline")
          .eq("organization_id", orgIdNum)
          .order("id", { ascending: true });

        if (error) {
          console.error(error);
          toast.error("문제 목록을 불러오지 못했습니다.");
        } else {
          setProblems(data || []);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [organizationId, supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return problems;
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [problems, search]);

  const allSelected = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((p) => selectedIds.includes(p.id));
  }, [filtered, selectedIds]);

  const handleToggleSelectAll = () => {
    if (allSelected) {
      // 기존 동작을 유지: 모두 해제
      setSelectedIds([]);
    } else {
      // 현재 필터 결과 전체를 선택
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const toggleSelect = (pid: number) => {
    setSelectedIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("퀴즈 제목을 입력하세요.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("최소 1개 이상의 문제를 선택하세요.");
      return;
    }

    if (timeLimitMin < 1) {
      toast.error("제한 시간(분)은 1 이상이어야 합니다.");
      return;
    }

    const startDate = parseLocalDatetime(startLocal);
    const endDate = parseLocalDatetime(endLocal);
    const publishedDate = publishedLocal
      ? parseLocalDatetime(publishedLocal)
      : new Date();
    if (!startDate || !endDate) {
      toast.error("시작/마감 시간을 올바르게 입력하세요.");
      return;
    }
    if (endDate <= startDate) {
      toast.error("마감 시간은 시작 시간보다 뒤여야 합니다.");
      return;
    }

    if (!organizationId) return;

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요합니다.");
        return;
      }

      const orgIdNum = Number(organizationId);

      // payload 구성
      const payload: {
        organization_id: number;
        title: string;
        description: string | null;
        time_limit_sec: number;
        start_at: string;
        end_at: string;
        published_at: string; // 공개 시각 (비워두면 즉시 공개 => now)
        assignment_mode: AssignmentMode;
        created_by: string; // user id
        global_problem_id?: number; // only for one_for_all mode
      } = {
        organization_id: orgIdNum,
        title: title.trim(),
        description: description.trim() || null,
        time_limit_sec: timeLimitMin * 60,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        published_at: (publishedDate as Date).toISOString(),
        assignment_mode: assignmentMode,
        created_by: user.id,
      };

      if (assignmentMode === "one_for_all") {
        payload.global_problem_id =
          selectedIds[Math.floor(Math.random() * selectedIds.length)];
      }

      // quizzes insert
      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .insert(payload)
        .select("id")
        .single();

      if (qErr || !quiz) {
        console.error(qErr);
        toast.error("퀴즈 생성에 실패했습니다.");
        return;
      }

      // 문제 매핑: one_per_attempt일 때만 저장 (응시 시 무작위 추출 용)
      if (assignmentMode === "one_per_attempt") {
        const rows = selectedIds.map((pid, i) => ({
          quiz_id: quiz.id,
          problem_id: pid,
          order_index: i,
        }));
        const { error: qpErr } = await supabase
          .from("quiz_problems")
          .insert(rows);
        if (qpErr) {
          console.error(qpErr);
          toast.error("퀴즈 문제 저장에 실패했습니다.");
          return;
        }
      }

      toast.success(
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-[10px] leading-none">
            ✓
          </span>
          <div className="flex flex-col text-left">
            <span className="font-medium">퀴즈 생성 완료</span>
            <span className="text-xs opacity-70">문제 풀 저장 완료</span>
          </div>
        </div>,
        {
          icon: false,
          autoClose: 1400,
          closeButton: false,
          hideProgressBar: true,
          position: "bottom-right",
          className:
            "rounded-md border border-green-200 dark:border-green-900/40 shadow-sm py-2",
        },
      );

      router.replace(`/organization/${organizationId}/quizzes`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">퀴즈 생성</h1>
        <Link
          href={`/organization/${organizationId}/quizzes`}
          className="text-sm underline underline-offset-4"
        >
          퀴즈 목록
        </Link>
      </div>

      {/* 기본 정보 */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">제목</span>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="예: 5월 알고리즘 퀴즈"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">설명 (선택)</span>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            placeholder="참가 안내, 제한 시간, 규칙 등을 적어주세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      {/* 시간/출제 설정 */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium">제한 시간 (분)</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">시작 시간</span>
            <input
              type="datetime-local"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">마감 시간</span>
            <input
              type="datetime-local"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">공개 시각 (선택)</span>
            <input
              type="datetime-local"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={publishedLocal}
              onChange={(e) => setPublishedLocal(e.target.value)}
            />
            <span className="block text-xs text-muted-foreground">
              비워두면 즉시 공개됩니다.
            </span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">출제 방식</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="assignment_mode"
                checked={assignmentMode === "one_for_all"}
                onChange={() => setAssignmentMode("one_for_all")}
              />
              <span>전원 같은 1문제 (지정된 1문제만 출제)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="assignment_mode"
                checked={assignmentMode === "one_per_attempt"}
                onChange={() => setAssignmentMode("one_per_attempt")}
              />
              <span>응시마다 무작위 1문제 (선택된 목록에서 랜덤)</span>
            </label>
            {assignmentMode === "one_for_all" && (
              <p className="text-xs text-muted-foreground mt-1">
                * 선택한 문제들 중 <strong>임의의 1개</strong>가 모든 응시자에게
                배정됩니다.
              </p>
            )}
          </fieldset>
        </div>
        <p className="text-xs text-muted-foreground">
          * 입력한 시간은 브라우저 로컬시간 기준이며, 저장 시 UTC로 변환됩니다.
        </p>
      </div>

      {/* 문제 선택 */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-md border bg-transparent px-3 py-2 text-sm flex-1 min-w-[220px]"
            placeholder="문제 검색 (제목/설명)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={handleToggleSelectAll}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {allSelected ? "전체 선택 해제" : "전체 선택"}
          </button>
          <span className="text-sm text-muted-foreground ml-auto">
            선택됨: {selectedIds.length}개
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              문제 목록 ({filtered.length})
            </div>
            <div className="max-h-[380px] overflow-auto divide-y">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">
                  불러오는 중…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  결과가 없습니다.
                </div>
              ) : (
                filtered.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        #{p.id} {p.title}
                      </div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              선택된 문제 ({selectedIds.length})
            </div>
            <div className="max-h-[380px] overflow-auto divide-y">
              {selectedIds.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  아직 선택된 문제가 없습니다.
                </div>
              ) : (
                selectedIds.map((pid, idx) => {
                  const p = problems.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <div key={pid} className="flex items-start gap-3 p-3">
                      <span className="text-xs rounded-full border px-2 py-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          #{p.id} {p.title}
                        </div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {p.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSelect(pid)}
                        className="rounded-md border px-2 py-1 text-xs"
                        title="제거"
                      >
                        제거
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-md border px-3 py-2 text-sm"
        >
          취소
        </button>
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "생성 중…" : "퀴즈 생성"}
        </button>
      </div>
    </div>
  );
}

/** helpers */
function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function parseLocalDatetime(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
