"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { createClient } from "@lib/supabase/client";

type ProblemRow = {
  id: number;
  title: string;
  description: string | null;
  organization_id: number;
  deadline?: string | null;
};

type QuizRow = {
  id: number | string;
  organization_id: number;
  title: string;
  description: string | null;
  assignment_mode?: "one_for_all" | "one_per_attempt" | "all" | string | null;
  problem_count?: number | null;
  global_problem_id?: number | null;
  time_limit_sec: number;
  start_at: string;
  end_at: string;
  published_at?: string | null;
};

type QuizProblemRow = {
  problem_id: number;
  order_index: number;
};

type AssignmentMode = "one_for_all" | "one_per_attempt";

export default function EditQuizPage() {
  const { organizationId, quizId } = useParams<{
    organizationId: string;
    quizId: string;
  }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quizFound, setQuizFound] = useState(true);
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [timeLimitMin, setTimeLimitMin] = useState<number>(30);
  const [startLocal, setStartLocal] = useState<string>("");
  const [endLocal, setEndLocal] = useState<string>("");
  const [publishedLocal, setPublishedLocal] = useState<string>("");
  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("one_for_all");
  const [problemCount, setProblemCount] = useState<number>(1);

  useEffect(() => {
    const run = async () => {
      if (!organizationId || !quizId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const orgIdNum = Number(organizationId);
        const quizIdFilter = isUUID(quizId) ? quizId : Number(quizId);

        const [{ data: problemsData, error: problemsError }, quizResult] =
          await Promise.all([
            supabase
              .from("problems")
              .select("id, title, description, organization_id, deadline")
              .eq("organization_id", orgIdNum)
              .order("id", { ascending: true }),
            supabase
              .from("quizzes")
              .select("*")
              .eq("id", quizIdFilter)
              .eq("organization_id", orgIdNum)
              .maybeSingle(),
          ]);

        if (problemsError) {
          console.error(problemsError);
          toast.error("문제 목록을 불러오지 못했습니다.");
        } else {
          setProblems((problemsData as ProblemRow[]) || []);
        }

        if (quizResult.error) {
          console.error(quizResult.error);
          toast.error("퀴즈 정보를 불러오지 못했습니다.");
          setQuizFound(false);
          return;
        }

        const quiz = quizResult.data as QuizRow | null;
        if (!quiz) {
          setQuizFound(false);
          return;
        }

        setQuizFound(true);
        setTitle(quiz.title ?? "");
        setDescription(quiz.description ?? "");
        setTimeLimitMin(Math.max(1, Math.floor((quiz.time_limit_sec ?? 1800) / 60)));
        setStartLocal(toLocalDatetimeValue(new Date(quiz.start_at)));
        setEndLocal(toLocalDatetimeValue(new Date(quiz.end_at)));
        setPublishedLocal(
          quiz.published_at ? toLocalDatetimeValue(new Date(quiz.published_at)) : "",
        );

        const normalizedMode = normalizeAssignmentMode(quiz.assignment_mode);
        setAssignmentMode(normalizedMode);

        const { data: quizProblemsData, error: quizProblemsError } = await supabase
          .from("quiz_problems")
          .select("problem_id, order_index")
          .eq("quiz_id", quizIdFilter)
          .order("order_index", { ascending: true });

        if (quizProblemsError) {
          console.error(quizProblemsError);
          toast.error("퀴즈 문제 정보를 불러오지 못했습니다.");
          return;
        }

        let problemRows = (quizProblemsData || []) as QuizProblemRow[];
        if (problemRows.length === 0 && quiz.global_problem_id) {
          problemRows = [{ problem_id: quiz.global_problem_id, order_index: 0 }];
        }

        const initialSelected = problemRows.map((row) => row.problem_id);
        setSelectedIds(initialSelected);

        const storedCount =
          typeof quiz.problem_count === "number" && quiz.problem_count > 0
            ? Math.floor(quiz.problem_count)
            : 1;
        if (normalizedMode === "one_per_attempt") {
          const upper = Math.max(1, initialSelected.length);
          setProblemCount(Math.min(Math.max(1, storedCount), upper));
        } else {
          setProblemCount(storedCount);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [organizationId, quizId, supabase]);

  useEffect(() => {
    if (assignmentMode !== "one_per_attempt") return;
    const upper = Math.max(1, selectedIds.length);
    setProblemCount((prev) => {
      const normalized = Number.isFinite(prev) ? Math.floor(prev) : 1;
      return Math.min(Math.max(1, normalized), upper);
    });
  }, [assignmentMode, selectedIds.length]);

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
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filtered.map((p) => p.id));
  };

  const toggleSelect = (pid: number) => {
    setSelectedIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  const handleSave = async () => {
    if (!organizationId || !quizId) return;

    if (!title.trim()) {
      toast.error("퀴즈 제목을 입력하세요.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("최소 1개 이상의 문제를 선택하세요.");
      return;
    }

    const requestedCount = Math.floor(problemCount);
    if (assignmentMode === "one_per_attempt") {
      if (!Number.isFinite(requestedCount) || requestedCount < 1) {
        toast.error("문제 개수(n)는 1 이상이어야 합니다.");
        return;
      }
      if (requestedCount > selectedIds.length) {
        toast.error(
          `문제 개수(n=${requestedCount})는 선택한 문제 수(${selectedIds.length})를 넘을 수 없습니다.`,
        );
        return;
      }
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

    setSaving(true);
    try {
      const orgIdNum = Number(organizationId);
      const quizIdFilter = isUUID(quizId) ? quizId : Number(quizId);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        time_limit_sec: timeLimitMin * 60,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        published_at: (publishedDate as Date).toISOString(),
        assignment_mode: assignmentMode,
        problem_count:
          assignmentMode === "one_for_all" ? selectedIds.length : requestedCount,
        global_problem_id: null,
      };

      const { error: updateQuizError } = await supabase
        .from("quizzes")
        .update(payload)
        .eq("id", quizIdFilter)
        .eq("organization_id", orgIdNum);

      if (updateQuizError) {
        console.error(updateQuizError);
        toast.error("퀴즈 수정에 실패했습니다.");
        return;
      }

      const { error: deleteQuizProblemsError } = await supabase
        .from("quiz_problems")
        .delete()
        .eq("quiz_id", quizIdFilter);

      if (deleteQuizProblemsError) {
        console.error(deleteQuizProblemsError);
        toast.error("기존 퀴즈 문제 삭제에 실패했습니다.");
        return;
      }

      const rows = selectedIds.map((pid, idx) => ({
        quiz_id: quizIdFilter,
        problem_id: pid,
        order_index: idx,
      }));

      const { error: insertQuizProblemsError } = await supabase
        .from("quiz_problems")
        .insert(rows);

      if (insertQuizProblemsError) {
        console.error(insertQuizProblemsError);
        toast.error("퀴즈 문제 저장에 실패했습니다.");
        return;
      }

      toast.success("퀴즈가 수정되었습니다.");
      router.replace(`/organization/${organizationId}/quizzes/${quizId}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="rounded-md border p-4 text-sm text-center">불러오는 중…</div>
      </div>
    );
  }

  if (!quizFound) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4 text-center">
        <div className="text-sm">퀴즈를 찾을 수 없습니다.</div>
        <Link
          href={`/organization/${organizationId}/quizzes`}
          className="underline underline-offset-4 text-sm"
        >
          퀴즈 목록
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">퀴즈 편집</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/organization/${organizationId}/quizzes/${quizId}`}
            className="text-sm underline underline-offset-4"
          >
            퀴즈 상세
          </Link>
          <Link
            href={`/organization/${organizationId}/quizzes`}
            className="text-sm underline underline-offset-4"
          >
            퀴즈 목록
          </Link>
        </div>
      </div>

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
              <span>전원 동일 문제 (선택한 문제 전체)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="assignment_mode"
                checked={assignmentMode === "one_per_attempt"}
                onChange={() => setAssignmentMode("one_per_attempt")}
              />
              <span>응시마다 무작위 문제 (선택된 목록에서 랜덤)</span>
            </label>

            {assignmentMode === "one_per_attempt" && (
              <label className="flex items-center gap-2 text-sm mt-2">
                <span className="text-muted-foreground">문제 개수 (n)</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, selectedIds.length)}
                  className="w-24 rounded-md border bg-transparent px-2 py-1 text-sm"
                  value={problemCount}
                  onChange={(e) =>
                    setProblemCount(Number.parseInt(e.target.value || "1", 10))
                  }
                />
                <span className="text-xs text-muted-foreground">
                  (선택됨 {selectedIds.length}개)
                </span>
              </label>
            )}

            {assignmentMode === "one_for_all" && (
              <p className="text-xs text-muted-foreground mt-1">
                * 선택한 문제 <strong>전체</strong>가 모든 응시자에게 동일하게
                배정됩니다.
              </p>
            )}
            {assignmentMode === "one_per_attempt" && (
              <p className="text-xs text-muted-foreground mt-1">
                * 각 응시 시작 시 선택된 문제 풀에서 <strong>무작위로 n개</strong>
                를 배정합니다.
              </p>
            )}
          </fieldset>
        </div>
        <p className="text-xs text-muted-foreground">
          * 입력한 시간은 브라우저 로컬시간 기준이며, 저장 시 UTC로 변환됩니다.
        </p>
      </div>

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
              {filtered.length === 0 ? (
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
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "저장 중…" : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}

function normalizeAssignmentMode(mode: QuizRow["assignment_mode"]): AssignmentMode {
  return mode === "one_per_attempt" ? "one_per_attempt" : "one_for_all";
}

function toLocalDatetimeValue(d: Date) {
  if (Number.isNaN(d.getTime())) return "";
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

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}
