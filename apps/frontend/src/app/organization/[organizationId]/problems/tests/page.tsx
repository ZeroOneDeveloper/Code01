"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

import Editor from "@monaco-editor/react";
import { Bounce, toast } from "react-toastify";
import {
  Trash2,
  RefreshCw,
  PlusCircle,
  PlayCircle,
  Loader2,
} from "lucide-react";

import { TestCase } from "@lib/types";
import { createClient } from "@lib/supabase/client";

const DEFAULT_PY_TEMPLATE = `# 반드시 generate(seed: int) -> tuple[str, str]를 정의하세요.
# 반환: (input_text, output_text). 표준입력/출력 포맷은 문제 요구에 맞춰 작성하세요.
def generate(seed: int):
    import random
    rnd = random.Random(seed)
    # 예시: 두 수 더하기
    a = rnd.randint(1, 1000000)
    b = rnd.randint(1, 1000000)
    input_text = f"{a} {b}\\n"
    output_text = f"{a + b}\\n"
    return input_text, output_text
`;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function ProblemTestsPage() {
  const supabase = createClient();

  const params = useSearchParams();
  const problemId = Number(params.get("id") || 0);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TestCase[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Generator UI
  const [pyCode, setPyCode] = useState(DEFAULT_PY_TEMPLATE);
  const [count, setCount] = useState(100);
  const [baseSeed, setBaseSeed] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // 총 개수
    const { count: totalCount } = await supabase
      .from("test_cases")
      .select("*", { count: "exact", head: true })
      .eq("problem_id", problemId);

    setTotal(totalCount ?? 0);

    // 페이지 데이터
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("test_cases")
      .select("*")
      .eq("problem_id", problemId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      toast.error("테스트 케이스를 불러오지 못했습니다.", {
        theme: "light",
        transition: Bounce,
      });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [problemId, page, pageSize, supabase]);

  useEffect(() => {
    load();
  }, [page, load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!selected.size) return;
    if (!confirm(`선택한 ${selected.size}개의 테스트 케이스를 삭제할까요?`))
      return;

    const ids = Array.from(selected);
    const { error } = await supabase.from("test_cases").delete().in("id", ids);
    if (error) {
      toast.error("삭제 중 오류가 발생했습니다.", { transition: Bounce });
      return;
    }
    toast.success("삭제 완료", { transition: Bounce, autoClose: 1200 });
    setSelected(new Set());
    await load();
  }

  async function handleGenerate() {
    if (!pyCode.trim()) {
      toast.error("파이썬 코드를 입력해주세요.", { transition: Bounce });
      return;
    }
    const c = clamp(count, 100, 1000);
    setCount(c);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/problems/${problemId}/tests/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          python_code: pyCode,
          count: c,
          base_seed: Number(baseSeed) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "요청 실패");
      }
      const data = await res.json();
      toast.success(`생성 작업을 등록했습니다. (job #${data.job_id})`, {
        transition: Bounce,
        autoClose: 1600,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`생성 작업 등록 실패: ${message}`, { transition: Bounce });
    } finally {
      setSubmitting(false);
      // 목록 새로고침 (워커가 처리 후 반영되므로 즉시 변화는 없을 수 있음)
      // 약간의 지연 뒤 수동 새로고침 유도
      setTimeout(() => load(), 1000);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">테스트 케이스 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
          <button
            disabled={!selected.size}
            onClick={handleDeleteSelected}
            className={
              "inline-flex items-center gap-2 px-3 py-2 rounded-md border text-red-600 hover:bg-red-50" +
              (!selected.size ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            <Trash2 className="w-4 h-4" /> 선택 삭제
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3 w-10"></th>
              <th className="p-3">#</th>
              <th className="p-3">input (미리보기)</th>
              <th className="p-3">output (미리보기)</th>
              <th className="p-3">created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  불러오는 중...
                </td>
              </tr>
            ) : items.length ? (
              items.map((tc) => (
                <tr key={tc.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(tc.id)}
                      onChange={() => toggleSelect(tc.id)}
                    />
                  </td>
                  <td className="p-3">{tc.id}</td>
                  <td className="p-3 align-top">
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap">
                      {(tc.input ?? "").slice(0, 200)}
                      {(tc.input ?? "").length > 200 ? "..." : ""}
                    </pre>
                  </td>
                  <td className="p-3 align-top">
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap">
                      {(tc.output ?? "").slice(0, 200)}
                      {(tc.output ?? "").length > 200 ? "..." : ""}
                    </pre>
                  </td>
                  <td className="p-3">
                    {tc.created_at
                      ? new Date(tc.created_at).toLocaleString("sv-SE", {
                          timeZone: "Asia/Seoul",
                        })
                      : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  테스트 케이스가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-2">
        <button
          className="px-3 py-1.5 border rounded-md hover:bg-gray-50"
          onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
        >
          이전
        </button>
        <div className="text-sm">
          {page} / {totalPages}
        </div>
        <button
          className="px-3 py-1.5 border rounded-md hover:bg-gray-50"
          onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
        >
          다음
        </button>
      </div>

      {/* 생성기 UI */}
      <div className="rounded-lg border p-4 flex flex-col gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PlusCircle className="w-5 h-5" />
          파이썬 코드로 테스트 케이스 생성
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">개수 (100~1000)</label>
            <input
              type="number"
              className="w-full mt-1 p-2 border rounded-md"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              min={100}
              max={1000}
            />
          </div>
          <div>
            <label className="text-sm font-medium">baseSeed</label>
            <input
              type="number"
              className="w-full mt-1 p-2 border rounded-md"
              value={baseSeed}
              onChange={(e) => setBaseSeed(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="h-[40vh] border rounded-md">
          <Editor
            height="100%"
            defaultLanguage="python"
            value={pyCode}
            onChange={(v) => v && setPyCode(v)}
            options={{ fontSize: 14, minimap: { enabled: false } }}
          />
        </div>

        <div className="flex justify-end">
          <button
            disabled={submitting}
            onClick={handleGenerate}
            className={
              "inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700" +
              (submitting ? " opacity-60 cursor-not-allowed" : "")
            }
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" /> 생성 작업 등록
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600">
          ※ 보안/재현성을 위해 코드는 곧바로 DB에 쓰지 않고, 백그라운드 워커가
          컨테이너에서 실행 후 `test_cases`에 일괄 삽입합니다.
        </p>
      </div>
    </div>
  );
}
