"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { X, CalendarClock, Tags } from "lucide-react";
import Editor from "@monaco-editor/react";
import { User } from "@supabase/auth-js";
import { motion, AnimatePresence } from "framer-motion";
import { Bounce, toast } from "react-toastify";
import { FaJava } from "react-icons/fa";
import { SiC, SiCplusplus, SiPython } from "react-icons/si";
import { PiStarFourFill } from "react-icons/pi"; // expert
import { BsGraphUpArrow, BsGraphDownArrow, BsEmojiSmile } from "react-icons/bs"; // intermediate

import type { Language, Problem } from "@lib/types";
import { createClient } from "@lib/supabase/client";
import Head from "next/head";
import "katex/dist/katex.min.css";
import type { Options as ReactMarkdownOptions } from "react-markdown";
import type { Plugin, PluggableList } from "unified";
import type { Node as UnistNode } from "unist";

const ALL_LANGUAGES: { value: Language; label: string; icon: JSX.Element }[] = [
  {
    value: "python",
    label: "Python",
    icon: <SiPython className="text-blue-500" />,
  },
  {
    value: "java",
    label: "Java",
    icon: <FaJava className="text-orange-600" />,
  },
  { value: "c", label: "C", icon: <SiC className="text-cyan-700" /> },
  {
    value: "cpp",
    label: "C++",
    icon: <SiCplusplus className="text-blue-700" />,
  },
];

function isValidDate(dateStr: string) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function toInputLocal(dateIso: string | null | undefined) {
  if (!dateIso) return "";
  try {
    return new Date(dateIso).toLocaleString("sv-SE", {
      timeZone: "Asia/Seoul",
    });
  } catch {
    return "";
  }
}

// --- Normalize markdown text to avoid parsing issues caused by invisible/full-width chars
const normalizeMarkdown = (s: string) =>
  (s ?? "")
    // 1) Unicode compatibility normalization (handles most full‑width forms)
    .normalize("NFKC")
    // 2) normalize common & exotic spaces
    .replace(/\u00A0/g, " ") // no‑break space → space
    .replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, " ") // thin spaces → space
    // 3) strip zero‑width & bidi controls that confuse parsers
    .replace(
      /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u202A-\u202E\u2066-\u2069]/g,
      "",
    )
    // 4) normalize smart quotes to ASCII to avoid delimiter confusion near emphasis markers
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // 5) ensure any remaining full‑width emphasis punctuation is ASCII (just in case)
    .replace(/\uFF0A/g, "*") // ＊ → *
    .replace(/\uFF3F/g, "_"); // ＿ → _

const NewProblemPage = () => {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const params = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editProblemId, setEditProblemId] = useState<number | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Add availableLanguages and grade state
  const [availableLanguages, setAvailableLanguages] = useState<
    ("python" | "java" | "c" | "cpp")[]
  >([]);
  const [grade, setGrade] = useState<
    "expert" | "advanced" | "intermediate" | "beginner" | ""
  >("");
  const [code, setCode] = useState("");
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [memoryLimit, setMemoryLimit] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState(
    new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Seoul",
    }),
  );
  const [inputDescription, setInputDescription] = useState("");
  const [outputDescription, setOutputDescription] = useState("");
  const [source, setSource] = useState("");
  // --- image upload state/refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageTarget, setImageTarget] = useState<
    "description" | "input" | "output" | null
  >(null);
  const [conditions, setConditions] = useState<string[]>([""]);
  const [examplePairs, setExamplePairs] = useState([{ input: "", output: "" }]);
  // track images uploaded via editor to persist on save
  const [uploadedImages, setUploadedImages] = useState<
    { path: string; url: string; section: "description" | "input" | "output" }[]
  >([]);
  // 태그
  const [tags, setTags] = useState<string[]>([]);

  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");

  const [editorTheme, setEditorTheme] = useState("light");
  // --- Markdown + KaTeX preview loader ---
  type MDIO = UnistNode | string | undefined;
  type MarkdownLibs = {
    ReactMarkdown: React.ComponentType<ReactMarkdownOptions>;
    remarkMath: Plugin<unknown[], MDIO, MDIO>;
    remarkGfm: Plugin<unknown[], MDIO, MDIO>;
    rehypeKatex: Plugin<unknown[], MDIO, MDIO>;
  };
  const [mdReady, setMdReady] = useState(false);
  const mdLibsRef = useRef<MarkdownLibs | null>(null); // { ReactMarkdown, remarkMath, remarkGfm, rehypeKatex }
  const previewDesc = true;
  const previewInput = true;
  const previewOutput = true;
  const splitDesc = true;
  const splitInput = true;
  const splitOutput = true;
  useEffect(() => {
    (async () => {
      try {
        const [rm, rmath, rgfm, rkatex] = await Promise.all([
          import("react-markdown"),
          import("remark-math"),
          import("remark-gfm"),
          import("rehype-katex"),
        ]);
        mdLibsRef.current = {
          ReactMarkdown:
            rm.default as React.ComponentType<ReactMarkdownOptions>,
          remarkMath: ((rmath as { default?: unknown })?.default ??
            rmath) as unknown as Plugin<unknown[], MDIO, MDIO>,
          remarkGfm: ((rgfm as { default?: unknown })?.default ??
            rgfm) as unknown as Plugin<unknown[], MDIO, MDIO>,
          rehypeKatex: ((rkatex as { default?: unknown })?.default ??
            rkatex) as unknown as Plugin<unknown[], MDIO, MDIO>,
        };
        setMdReady(true);
      } catch {
        setMdReady(false);
      }
    })();
  }, []);
  const { theme } = useTheme();
  // --- refs for first-error scroll/focus ---
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const publishedAtRef = useRef<HTMLInputElement>(null);
  const inputDescRef = useRef<HTMLTextAreaElement>(null);
  const outputDescRef = useRef<HTMLTextAreaElement>(null);
  const languagesRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const conditionsRef = useRef<HTMLInputElement>(null);
  const examplesRef = useRef<HTMLTextAreaElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  // track focused condition input & refs for caret insertion
  const conditionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeConditionIndex, setActiveConditionIndex] = useState<
    number | null
  >(null);
  const scrollIntoCenterAndFocus = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // try to focus the element or its first focusable child
    if (typeof el.focus === "function") {
      el.focus({ preventScroll: true });
    } else {
      const focusable = el.querySelector<HTMLElement>(
        "input, textarea, button, select, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus({ preventScroll: true });
    }
  };

  const focusFirstError = (e: FieldErrors) => {
    const order: (keyof FieldErrors)[] = [
      "title",
      "description",
      "publishedAt",
      "inputDescription",
      "outputDescription",
      "availableLanguages",
      "grade",
      "conditions",
      "examples",
      "deadline",
    ];
    for (const key of order) {
      if (!e[key]) continue;
      switch (key) {
        case "title":
          return scrollIntoCenterAndFocus(titleRef.current!);
        case "description":
          return scrollIntoCenterAndFocus(descriptionRef.current!);
        case "publishedAt":
          return scrollIntoCenterAndFocus(publishedAtRef.current!);
        case "inputDescription":
          return scrollIntoCenterAndFocus(inputDescRef.current!);
        case "outputDescription":
          return scrollIntoCenterAndFocus(outputDescRef.current!);
        case "availableLanguages":
          return scrollIntoCenterAndFocus(
            languagesRef.current?.querySelector("button") as HTMLElement,
          );
        case "grade":
          return scrollIntoCenterAndFocus(
            gradeRef.current?.querySelector("button") as HTMLElement,
          );
        case "conditions":
          return scrollIntoCenterAndFocus(conditionsRef.current!);
        case "examples":
          return scrollIntoCenterAndFocus(examplesRef.current!);
        case "deadline":
          return scrollIntoCenterAndFocus(deadlineRef.current!);
      }
    }
  };

  // --- transfer organization modal state ---
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [orgOptions, setOrgOptions] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [selectedTransferOrgId, setSelectedTransferOrgId] = useState<
    number | null
  >(null);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  // prevent double submit on create/update
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- image upload helpers (Markdown image insertion) ---
  const openImagePicker = (target: "description" | "input" | "output") => {
    setImageTarget(target);
    fileInputRef.current?.click();
  };

  const insertAtCursor = (
    ref: HTMLTextAreaElement | null,
    snippet: string,
    setValue: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!ref) {
      setValue((prev: string) => prev + snippet);
      return;
    }
    const start = ref.selectionStart ?? ref.value.length;
    const end = ref.selectionEnd ?? ref.value.length;
    const next = ref.value.slice(0, start) + snippet + ref.value.slice(end);
    setValue(next);
    setTimeout(() => {
      ref.focus();
      const pos = start + snippet.length;
      try {
        ref.setSelectionRange(pos, pos);
      } catch {}
    }, 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // reset so selecting the same file twice still triggers onChange
    e.target.value = "";
    if (!f) return;

    try {
      if (!user) {
        toast.error("로그인이 필요합니다.");
        return;
      }
      const path = `${user.id}/problems/${Date.now()}_${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("problem-assets")
        .upload(path, f, { upsert: true, contentType: f.type });

      if (upErr) {
        toast.error(
          `이미지 업로드 실패: ${upErr.message ?? "알 수 없는 오류"}`,
        );
        return;
      }

      const { data: pub } = supabase.storage
        .from("problem-assets")
        .getPublicUrl(path);

      const url = pub?.publicUrl ?? "";
      if (!url) {
        toast.error("공개 URL을 가져오지 못했습니다.");
        return;
      }

      const snippet = `![image](${url})`;
      if (imageTarget === "description") {
        insertAtCursor(
          descriptionRef.current as HTMLTextAreaElement | null,
          snippet,
          setDescription,
        );
      } else if (imageTarget === "input") {
        insertAtCursor(
          inputDescRef.current as HTMLTextAreaElement | null,
          snippet,
          setInputDescription,
        );
      } else if (imageTarget === "output") {
        insertAtCursor(
          outputDescRef.current as HTMLTextAreaElement | null,
          snippet,
          setOutputDescription,
        );
      }
      // remember this image to link with the problem on save
      setUploadedImages((prev) => [
        ...prev,
        {
          path,
          url,
          section: imageTarget as "description" | "input" | "output",
        },
      ]);
      setImageTarget(null);
      toast.success("이미지를 삽입했습니다.");
    } catch {
      toast.error("이미지 업로드 중 오류가 발생했습니다.");
    }
  };

  // inline validation state (immediate guidance)
  type FieldErrors = {
    title?: string;
    description?: string;
    publishedAt?: string;
    inputDescription?: string;
    outputDescription?: string;
    availableLanguages?: string;
    grade?: string;
    conditions?: string;
    examples?: string;
    deadline?: string;
  };
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({
    title: false,
    description: false,
    publishedAt: false,
    inputDescription: false,
    outputDescription: false,
    availableLanguages: false,
    grade: false,
    conditions: false,
    examples: false,
    deadline: false,
  });

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요합니다.", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: theme === "dark" ? "dark" : "light",
          transition: Bounce,
        });
        return;
      }
      setUser(user);
    };

    fetchUser();
  }, [supabase, theme]);

  useEffect(() => {
    setEditorTheme(theme === "dark" ? "vs-dark" : "light");
  }, [theme]);

  useEffect(() => {
    const run = async () => {
      const orgId = parseInt(params.organizationId);
      if (Number.isNaN(orgId)) return;

      const idStr = searchParams.get("id");
      const idNum = idStr ? Number(idStr) : null;
      if (idNum && !Number.isNaN(idNum)) {
        setLoadingExisting(true);
        setEditProblemId(idNum);
      }

      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("organization_id", orgId);

      if (error || !data) {
        if (idNum) {
          toast.error("문제를 불러오지 못했습니다.", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: theme === "dark" ? "dark" : "light",
            transition: Bounce,
          });
        }
        setLoadingExisting(false);
        return;
      }

      // Build tag suggestions from all problems in the org
      const freq = new Map<string, number>();
      for (const row of data as Problem[]) {
        const arr = Array.isArray(row.tags) ? row.tags : [];
        for (const t of arr) {
          if (typeof t !== "string") continue;
          const key = t.trim();
          if (!key) continue;
          freq.set(key, (freq.get(key) || 0) + 1);
        }
      }
      const sorted = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);
      setTagSuggestions(sorted);

      // If editing, hydrate fields from the same dataset
      if (idNum && !Number.isNaN(idNum)) {
        const p = (data as Problem[]).find((row) => row.id === idNum);
        if (!p) {
          toast.error("문제를 불러오지 못했습니다.", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: theme === "dark" ? "dark" : "light",
            transition: Bounce,
          });
          setLoadingExisting(false);
          return;
        }

        setIsEditing(true);
        setTitle(p.title ?? "");
        setDescription(p.description ?? "");
        setPublishedAt(p.published_at ? toInputLocal(p.published_at) : "");
        setInputDescription(p.input_description ?? "");
        setOutputDescription(p.output_description ?? "");
        setSource(typeof p.source === "string" ? p.source : "");
        setConditions(
          Array.isArray(p.conditions) && p.conditions.length
            ? (p.conditions as string[])
            : [""],
        );

        const si = Array.isArray(p.sample_inputs)
          ? (p.sample_inputs as string[])
          : [];
        const so = Array.isArray(p.sample_outputs)
          ? (p.sample_outputs as string[])
          : [];
        const maxLen = Math.max(si.length, so.length);
        setExamplePairs(
          (maxLen ? Array.from({ length: maxLen }) : [{}]).map((_, i) => ({
            input: si[i] ?? "",
            output: so[i] ?? "",
          })) as { input: string; output: string }[],
        );

        setCode(p.default_code ?? "");
        setTimeLimit(
          typeof p.time_limit === "number" ? (p.time_limit as number) : null,
        );
        setMemoryLimit(
          typeof p.memory_limit === "number"
            ? (p.memory_limit as number)
            : null,
        );

        const has = !!p.deadline;
        setHasDeadline(has);
        setDeadline(has && p.deadline ? toInputLocal(p.deadline) : "");

        setAvailableLanguages(
          Array.isArray(p.available_languages)
            ? (p.available_languages as ("python" | "java" | "c" | "cpp")[])
            : [],
        );
        setGrade(p.grade ?? "");
        setTags(Array.isArray(p.tags) ? (p.tags as string[]) : []);

        toast.success("기존 문제를 불러왔어요.", {
          position: "top-right",
          autoClose: 1400,
          hideProgressBar: true,
          closeOnClick: true,
          theme: theme === "dark" ? "dark" : "light",
          transition: Bounce,
        });
      }

      setLoadingExisting(false);
    };
    run();
  }, [supabase, params.organizationId, searchParams, theme]);

  // --- organization transfer helpers ---
  const openTransferModal = async () => {
    if (!user) return toast.error("로그인이 필요합니다.");
    setLoadingTransfer(true);

    // 권한 확인: 현재 조직에서 ADMIN인지
    const { data: member, error: memberErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", params.organizationId)
      .single();

    if (memberErr || !member || member.role.toUpperCase() !== "ADMIN") {
      setLoadingTransfer(false);
      toast.error("권한이 없습니다.");
      return;
    }

    // 사용자가 ADMIN인 조직 목록 조회
    const { data: adminRows, error: adminErr } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (adminErr || !adminRows) {
      setLoadingTransfer(false);
      toast.error("조직 목록을 불러오지 못했습니다.");
      return;
    }

    const currentOrgId = parseInt(params.organizationId);
    const targetIds = adminRows
      .map((r: { organization_id: number }) => r.organization_id)
      .filter(
        (id: number | null | undefined) =>
          typeof id === "number" && id !== currentOrgId,
      );

    if (targetIds.length === 0) {
      setLoadingTransfer(false);
      toast.info("이동 가능한 조직이 없습니다.");
      return;
    }

    const { data: orgs, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", targetIds);

    if (orgErr || !orgs) {
      setLoadingTransfer(false);
      toast.error("조직 목록을 불러오지 못했습니다.");
      return;
    }

    setOrgOptions(orgs as { id: number; name: string }[]);
    setSelectedTransferOrgId(
      (orgs[0] as { id: number; name: string })?.id ?? null,
    );
    setIsTransferOpen(true);
    setLoadingTransfer(false);
  };

  const handleConfirmTransfer = async () => {
    if (!editProblemId) return;
    if (!selectedTransferOrgId) {
      toast.error("이동할 조직을 선택하세요.");
      return;
    }

    const { error: updateErr } = await supabase
      .from("problems")
      .update({ organization_id: selectedTransferOrgId })
      .eq("id", editProblemId);

    if (updateErr) {
      toast.error("조직 이동에 실패했습니다.");
    } else {
      toast.success("조직을 이동했습니다.");
      setIsTransferOpen(false);
      router.push(`/organization/${selectedTransferOrgId}/problems`);
      router.refresh();
    }
  };

  // --- helpers for tags ---
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const normalizeTag = (s: string) => s.trim();

  // Inline, polished tag selector with autocomplete dropdown
  const TagSelector: React.FC<{
    value: string[];
    onChange: (next: string[]) => void;
    suggestions: string[];
  }> = ({ value, onChange, suggestions }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (!ref.current) return;
        if (!ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const selected = new Set(value.map((v) => normalizeTag(v)));
    const filtered = suggestions
      .filter(
        (s) =>
          !selected.has(normalizeTag(s)) &&
          s.toLowerCase().includes(q.toLowerCase()),
      )
      .slice(0, 8);

    function addTag(label: string) {
      const t = normalizeTag(label);
      if (!t) return;
      if (!value.includes(t)) onChange([...value, t]);
      setQ("");
      setOpen(false);
    }
    function removeTag(label: string) {
      onChange(value.filter((v) => v !== label));
    }

    const Highlight: React.FC<{ text: string; q: string }> = ({ text, q }) => {
      if (!q) return <>{text}</>;
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i === -1) return <>{text}</>;
      return (
        <>
          {text.slice(0, i)}
          <span className="font-semibold underline decoration-dotted underline-offset-4">
            {text.slice(i, i + q.length)}
          </span>
          {text.slice(i + q.length)}
        </>
      );
    };

    return (
      <div ref={ref} className="relative">
        <div
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm transition duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-wrap items-center gap-2"
          onClick={() => setOpen(true)}
        >
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-2.5 py-1 text-sm"
            >
              <span>{v}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(v);
                }}
                className="rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === "," || e.key === "Tab") &&
                q.trim()
              ) {
                e.preventDefault();
                addTag(q);
              }
              if (e.key === "Backspace" && !q && value.length) {
                removeTag(value[value.length - 1]);
              }
            }}
            placeholder={value.length ? "" : "태그 입력…"}
            className="flex-1 bg-transparent text-black dark:text-white outline-none placeholder:text-gray-400"
          />
        </div>

        {open && (filtered.length > 0 || q) && (
          <ul className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-xl">
            {filtered.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => addTag(item)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Highlight text={item} q={q} />
                </button>
              </li>
            ))}
            {q &&
              !suggestions.some(
                (s) => s.toLowerCase() === q.trim().toLowerCase(),
              ) && (
                <li className="border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => addTag(q)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <span className="inline-flex items-center justify-center rounded-md border px-1.5 text-xs">
                      +
                    </span>
                    “{q}” 새 태그 추가
                  </button>
                </li>
              )}
          </ul>
        )}
      </div>
    );
  };

  const computeErrors = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!title.trim()) e.title = "제목을 입력하세요.";
    if (!description.trim()) e.description = "문제 설명을 입력하세요.";
    if (!publishedAt || !isValidDate(publishedAt))
      e.publishedAt = "유효한 날짜 및 시간을 입력하세요.";
    if (!inputDescription.trim())
      e.inputDescription = "입력 설명을 입력하세요.";
    if (!outputDescription.trim())
      e.outputDescription = "출력 설명을 입력하세요.";
    if (!Array.isArray(availableLanguages) || availableLanguages.length === 0)
      e.availableLanguages = "최소 1개 언어를 선택하세요.";
    if (!grade) e.grade = "난이도를 선택하세요.";
    if (hasDeadline && (!deadline || !isValidDate(deadline)))
      e.deadline = "유효한 마감 기한을 입력하세요.";
    return e;
  };

  useEffect(() => {
    setErrors(computeErrors());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    publishedAt,
    inputDescription,
    outputDescription,
    availableLanguages,
    grade,
    conditions,
    examplePairs,
    hasDeadline,
    deadline,
  ]);

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      <Head>
        <style>{`
          /* Hide KaTeX's MathML layer to prevent duplicate visible text,
             keep it accessible for screen readers. */
          .katex .katex-mathml {
            position: absolute !important;
            display: none !important; /* prevent duplicate visible text */
            overflow: hidden !important;
            clip: rect(1px, 1px, 1px, 1px) !important;
            height: 1px !important;
            width: 1px !important;
            padding: 0 !important;
            border: 0 !important;
            white-space: nowrap !important;
          }
          .katex .katex-html { position: relative; }
        `}</style>
      </Head>
      <div className="flex flex-col justify-center gap-8 p-6">
        {isEditing && (
          <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm">
            현재 <strong>문제 #{editProblemId}</strong> 수정 중입니다.
          </div>
        )}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            제목 <span className="text-red-500">*</span>
          </h1>
          <input
            ref={titleRef}
            type="text"
            className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 ${
              touched.title && errors.title
                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            }`}
            placeholder="문제 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            aria-invalid={touched.title && !!errors.title}
            aria-describedby={
              touched.title && errors.title ? "error-title" : undefined
            }
          />
          {touched.title && errors.title && (
            <p id="error-title" className="text-sm text-red-500">
              {errors.title}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            문제 설명 <span className="text-red-500">*</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openImagePicker("description")}
              className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              이미지 업로드
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              이미지: <code>![설명](url)</code> · 수식: <code>$M_{"{n}"}</code>,{" "}
              <code>$$ ... $$</code>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            LaTeX: <code>$...$</code>, <code>$$...$$</code>
          </div>
          <div
            className={
              splitDesc && previewDesc
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "flex flex-col gap-2"
            }
          >
            <textarea
              ref={descriptionRef}
              className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 resize-none ${
                splitDesc && previewDesc ? "min-h-[260px]" : "min-h-[150px]"
              } ${
                touched.description && errors.description
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="문제에 대한 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              aria-invalid={touched.description && !!errors.description}
              aria-describedby={
                touched.description && errors.description
                  ? "error-description"
                  : undefined
              }
            />

            {previewDesc && (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/40 prose prose-base max-w-none leading-7 tracking-[0.005em] dark:prose-invert prose-headings:font-semibold prose-p:my-2 prose-li:my-1 prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-black/5 dark:prose-pre:bg-slate-900/70 prose-pre:p-3 break-words whitespace-pre-wrap prose-pre:overflow-x-auto">
                {mdReady ? (
                  (() => {
                    const RM = mdLibsRef.current!
                      .ReactMarkdown as React.ComponentType<ReactMarkdownOptions>;
                    const remarkPlugins: PluggableList = [
                      mdLibsRef.current!.remarkGfm,
                      mdLibsRef.current!.remarkMath,
                    ];
                    const rehypePlugins: PluggableList = [
                      [mdLibsRef.current!.rehypeKatex, { output: "html" }],
                    ];
                    return (
                      <RM
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                      >
                        {normalizeMarkdown(description)}
                      </RM>
                    );
                  })()
                ) : (
                  <div className="text-xs text-gray-500">
                    미리보기를 사용하려면 패키지 설치가 필요합니다:{" "}
                    <code>
                      pnpm add react-markdown remark-math rehype-katex katex
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
          {touched.description && errors.description && (
            <p id="error-description" className="text-sm text-red-500">
              {errors.description}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            공개 날짜 및 시간 <span className="text-red-500">*</span>
          </h1>
          <input
            ref={publishedAtRef}
            type="datetime-local"
            className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 ${
              touched.publishedAt && errors.publishedAt
                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            }`}
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, publishedAt: true }))}
            aria-invalid={touched.publishedAt && !!errors.publishedAt}
            aria-describedby={
              touched.publishedAt && errors.publishedAt
                ? "error-publishedAt"
                : undefined
            }
          />
          {touched.publishedAt && errors.publishedAt && (
            <p id="error-publishedAt" className="text-sm text-red-500">
              {errors.publishedAt}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" />
            마감 기한
          </h1>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {hasDeadline ? "마감 설정됨" : "마감 없음"}
              </span>
            </label>
          </div>
          <AnimatePresence>
            {hasDeadline && (
              <motion.input
                ref={deadlineRef}
                key="deadline-input"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                type="datetime-local"
                className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 ${
                  touched.deadline && errors.deadline
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                }`}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, deadline: true }))}
                aria-invalid={touched.deadline && !!errors.deadline}
                aria-describedby={
                  touched.deadline && errors.deadline
                    ? "error-deadline"
                    : undefined
                }
              />
            )}
          </AnimatePresence>
          {hasDeadline && touched.deadline && errors.deadline && (
            <p id="error-deadline" className="text-sm text-red-500">
              {errors.deadline}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">조건</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            LaTeX: <code>$...$</code>, <code>$$...$$</code>
          </p>
          <div className="flex gap-2 flex-wrap">
            {[">", "<", "≥", "≤"].map((symbol, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  // pick active condition index or fallback to the last one
                  const fallbackIdx = Math.max(0, conditions.length - 1);
                  const idxToUse =
                    activeConditionIndex !== null &&
                    activeConditionIndex >= 0 &&
                    activeConditionIndex < conditions.length
                      ? activeConditionIndex
                      : fallbackIdx;

                  const el = conditionRefs.current[idxToUse];
                  const currentValue =
                    typeof el?.value === "string"
                      ? el.value
                      : (conditions[idxToUse] ?? "");

                  const start = el?.selectionStart ?? currentValue.length;
                  const end = el?.selectionEnd ?? currentValue.length;

                  const nextValue =
                    currentValue.slice(0, start) +
                    symbol +
                    currentValue.slice(end);

                  setConditions((prev) => {
                    const updated = [...prev];
                    updated[idxToUse] = nextValue;
                    return updated;
                  });

                  // restore focus & caret after state update
                  setTimeout(() => {
                    const target = conditionRefs.current[idxToUse];
                    if (target) {
                      const pos = start + symbol.length;
                      target.focus();
                      try {
                        target.setSelectionRange(pos, pos);
                      } catch {}
                    }
                  }, 0);
                }}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
              >
                {symbol}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {conditions.map((condition, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start"
              >
                {/* left: editor */}
                <div className="flex gap-2 items-center min-w-0">
                  <input
                    ref={(el) => {
                      if (index === 0) conditionsRef.current = el;
                      conditionRefs.current[index] = el;
                    }}
                    onFocus={() => setActiveConditionIndex(index)}
                    onClick={() => setActiveConditionIndex(index)}
                    onKeyUp={() => setActiveConditionIndex(index)}
                    onSelect={() => setActiveConditionIndex(index)}
                    type="text"
                    value={condition}
                    onChange={(e) => {
                      const newConditions = [...conditions];
                      newConditions[index] = e.target.value;
                      setConditions(newConditions);
                    }}
                    className="flex-1 min-w-0 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    placeholder={`조건 ${index + 1}`}
                    onBlur={() =>
                      setTouched((t) => ({ ...t, conditions: true }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setConditions((prev) => {
                        const next = prev.filter((_, i) => i !== index);
                        setActiveConditionIndex((cur) => {
                          if (cur === null) return cur;
                          if (cur === index)
                            return Math.min(index, next.length - 1);
                          if (cur > index) return cur - 1;
                          return cur;
                        });
                        conditionRefs.current.splice(index, 1);
                        return next;
                      });
                    }}
                    className="flex-none p-1 bg-red-500 hover:bg-red-600 text-white rounded transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* right: live preview */}
                <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/40 prose prose-base max-w-none leading-7 tracking-[0.005em] dark:prose-invert break-words whitespace-pre-wrap min-w-0">
                  {mdReady ? (
                    (() => {
                      const RM = mdLibsRef.current!
                        .ReactMarkdown as React.ComponentType<ReactMarkdownOptions>;
                      const remarkPlugins: PluggableList = [
                        mdLibsRef.current!.remarkGfm,
                        mdLibsRef.current!.remarkMath,
                      ];
                      const rehypePlugins: PluggableList = [
                        [mdLibsRef.current!.rehypeKatex, { output: "html" }],
                      ];
                      return (
                        <RM
                          remarkPlugins={remarkPlugins}
                          rehypePlugins={rehypePlugins}
                        >
                          {normalizeMarkdown(
                            condition ||
                              "미리보기: 조건 수식을 이곳에 표시합니다.",
                          )}
                        </RM>
                      );
                    })()
                  ) : (
                    <div className="text-xs text-gray-500">
                      미리보기를 사용하려면 패키지 설치가 필요합니다:{" "}
                      <code>
                        pnpm add react-markdown remark-math rehype-katex katex
                      </code>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setConditions([...conditions, ""])}
            className="self-start px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            조건 추가
          </button>
          {touched.conditions && errors.conditions && (
            <p id="error-conditions" className="text-sm text-red-500">
              {errors.conditions}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            입력 설명 <span className="text-red-500">*</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openImagePicker("input")}
              className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              이미지 업로드
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              이미지: <code>![설명](url)</code> · 수식: <code>$M_{"{n}"}</code>,{" "}
              <code>$$ ... $$</code>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            LaTeX: <code>$...$</code>, <code>$$...$$</code>
          </div>
          <div
            className={
              splitInput && previewInput
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "flex flex-col gap-2"
            }
          >
            <textarea
              ref={inputDescRef}
              className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 resize-none ${
                splitInput && previewInput ? "min-h-[260px]" : "min-h-[150px]"
              } ${
                touched.inputDescription && errors.inputDescription
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="입력 형식에 대한 설명을 입력하세요"
              value={inputDescription}
              onChange={(e) => setInputDescription(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, inputDescription: true }))
              }
              aria-invalid={
                touched.inputDescription && !!errors.inputDescription
              }
              aria-describedby={
                touched.inputDescription && errors.inputDescription
                  ? "error-inputDescription"
                  : undefined
              }
            />
            {previewInput && (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/40 prose prose-base max-w-none leading-7 tracking-[0.005em] dark:prose-invert prose-headings:font-semibold prose-p:my-2 prose-li:my-1 prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-black/5 dark:prose-pre:bg-slate-900/70 prose-pre:p-3 break-words whitespace-pre-wrap prose-pre:overflow-x-auto">
                {mdReady ? (
                  (() => {
                    const RM = mdLibsRef.current!
                      .ReactMarkdown as React.ComponentType<ReactMarkdownOptions>;
                    const remarkPlugins: PluggableList = [
                      mdLibsRef.current!.remarkGfm,
                      mdLibsRef.current!.remarkMath,
                    ];
                    const rehypePlugins: PluggableList = [
                      [mdLibsRef.current!.rehypeKatex, { output: "html" }],
                    ];
                    return (
                      <RM
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                      >
                        {normalizeMarkdown(inputDescription)}
                      </RM>
                    );
                  })()
                ) : (
                  <div className="text-xs text-gray-500">
                    미리보기를 사용하려면 패키지 설치가 필요합니다:{" "}
                    <code>
                      pnpm add react-markdown remark-math rehype-katex katex
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
          {touched.inputDescription && errors.inputDescription && (
            <p id="error-inputDescription" className="text-sm text-red-500">
              {errors.inputDescription}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            출력 설명 <span className="text-red-500">*</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openImagePicker("output")}
              className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              이미지 업로드
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              이미지: <code>![설명](url)</code> · 수식: <code>$M_{"{n}"}</code>,{" "}
              <code>$$ ... $$</code>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            LaTeX: <code>$...$</code>, <code>$$...$$</code>
          </div>
          <div
            className={
              splitOutput && previewOutput
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "flex flex-col gap-2"
            }
          >
            <textarea
              ref={outputDescRef}
              className={`w-full p-3 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 transition duration-200 resize-none ${
                splitOutput && previewOutput ? "min-h-[260px]" : "min-h-[150px]"
              } ${
                touched.outputDescription && errors.outputDescription
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder="출력 형식에 대한 설명을 입력하세요"
              value={outputDescription}
              onChange={(e) => setOutputDescription(e.target.value)}
              onBlur={() =>
                setTouched((t) => ({ ...t, outputDescription: true }))
              }
              aria-invalid={
                touched.outputDescription && !!errors.outputDescription
              }
              aria-describedby={
                touched.outputDescription && errors.outputDescription
                  ? "error-outputDescription"
                  : undefined
              }
            />
            {previewOutput && (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/40 prose prose-base max-w-none leading-7 tracking-[0.005em] dark:prose-invert prose-headings:font-semibold prose-p:my-2 prose-li:my-1 prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-black/5 dark:prose-pre:bg-slate-900/70 prose-pre:p-3 break-words whitespace-pre-wrap prose-pre:overflow-x-auto">
                {mdReady ? (
                  (() => {
                    const RM = mdLibsRef.current!
                      .ReactMarkdown as React.ComponentType<ReactMarkdownOptions>;
                    const remarkPlugins: PluggableList = [
                      mdLibsRef.current!.remarkGfm,
                      mdLibsRef.current!.remarkMath,
                    ];
                    const rehypePlugins: PluggableList = [
                      [mdLibsRef.current!.rehypeKatex, { output: "html" }],
                    ];
                    return (
                      <RM
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                      >
                        {normalizeMarkdown(outputDescription)}
                      </RM>
                    );
                  })()
                ) : (
                  <div className="text-xs text-gray-500">
                    미리보기를 사용하려면 패키지 설치가 필요합니다:{" "}
                    <code>
                      pnpm add react-markdown remark-math rehype-katex katex
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
          {touched.outputDescription && errors.outputDescription && (
            <p id="error-outputDescription" className="text-sm text-red-500">
              {errors.outputDescription}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">출처</h1>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="예: 백준 1234, 원문 링크, 저자 등"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            출처는 비워둘 수 있어요.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="w-6 h-6" /> 태그
          </h1>
          <TagSelector
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            입력한 태그를 그대로 저장합니다. 한국어/영문 모두 입력 가능해요.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            예시 입/출력
          </h1>
          <AnimatePresence>
            {examplePairs.map((pair, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2 border border-gray-300 dark:border-gray-600 rounded-md p-3"
              >
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold">예시 #{index + 1}</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setExamplePairs(
                        examplePairs.filter((_, i) => i !== index),
                      )
                    }
                    className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <textarea
                  value={pair.input}
                  onChange={(e) => {
                    const newPairs = [...examplePairs];
                    newPairs[index].input = e.target.value;
                    setExamplePairs(newPairs);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="예시 입력"
                />
                <textarea
                  ref={index === 0 ? examplesRef : null}
                  value={pair.output}
                  onChange={(e) => {
                    const newPairs = [...examplePairs];
                    newPairs[index].output = e.target.value;
                    setExamplePairs(newPairs);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="예시 출력"
                  onBlur={() => setTouched((t) => ({ ...t, examples: true }))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() =>
              setExamplePairs([...examplePairs, { input: "", output: "" }])
            }
            className="self-start px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            예시 추가
          </button>
          {touched.examples && errors.examples && (
            <p id="error-examples" className="text-sm text-red-500">
              {errors.examples}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">문제 코드 기본값</h1>
          <Editor
            height="30vh"
            defaultLanguage="c"
            value={code}
            onChange={(value) => value && setCode(value)}
            theme={editorTheme}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-6">
        <div className="flex flex-col gap-4 px-6">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            제출 가능 언어 <span className="text-red-500">*</span>
          </h1>
          <div ref={languagesRef} className="flex gap-2 flex-wrap">
            {ALL_LANGUAGES.map(({ value, label, icon }) => {
              const isSelected = availableLanguages.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTouched((t) => ({ ...t, availableLanguages: true }));
                    setAvailableLanguages((prev) =>
                      isSelected
                        ? prev.filter((l) => l !== value)
                        : [...prev, value],
                    );
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all duration-200 transform ${
                    isSelected
                      ? "bg-blue-600 text-white scale-105"
                      : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                  } hover:scale-105`}
                >
                  {icon}
                  <span className="capitalize">{label}</span>
                </button>
              );
            })}
          </div>
          {touched.availableLanguages && errors.availableLanguages && (
            <p id="error-availableLanguages" className="text-sm text-red-500">
              {errors.availableLanguages}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 px-6">
          <h1 className="text-2xl font-bold flex items-center gap-1">
            난이도 <span className="text-red-500">*</span>
          </h1>
          <div ref={gradeRef} className="flex gap-2 flex-wrap">
            {(["expert", "advanced", "intermediate", "beginner"] as const).map(
              (level) => {
                const isActive = grade === level;
                const baseStyle =
                  "flex items-center gap-1 px-3 py-1 rounded-md border text-sm cursor-pointer transition-all transform duration-200";
                const activeStyle = "bg-blue-600 text-white scale-105";
                const inactiveStyle =
                  "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white hover:scale-105";

                const icon = {
                  expert: <PiStarFourFill className="text-red-600" />,
                  advanced: <BsGraphUpArrow className="text-orange-500" />,
                  intermediate: (
                    <BsGraphDownArrow className="text-yellow-500" />
                  ),
                  beginner: <BsEmojiSmile className="text-green-600" />,
                }[level];

                const label = {
                  expert: "최상급",
                  advanced: "상급",
                  intermediate: "중급",
                  beginner: "초급",
                }[level];

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setTouched((t) => ({ ...t, grade: true }));
                      setGrade(level);
                    }}
                    className={`${baseStyle} ${isActive ? activeStyle : inactiveStyle}`}
                  >
                    {icon}
                    {label}
                  </button>
                );
              },
            )}
          </div>
          {touched.grade && errors.grade && (
            <p id="error-grade" className="text-sm text-red-500">
              {errors.grade}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xl font-bold">시간 제한 (ms)</label>
          <input
            type="number"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="예: 2000"
            value={timeLimit === null ? "" : timeLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setTimeLimit(value);
              } else {
                setTimeLimit(null);
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xl font-bold">메모리 제한 (MB)</label>
          <input
            type="number"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            placeholder="예: 128"
            value={memoryLimit === null ? "" : memoryLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value)) {
                setMemoryLimit(value);
              } else {
                setMemoryLimit(null);
              }
            }}
          />
        </div>
      </div>
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          모든 정보를 입력한 후{" "}
          <strong className="text-black dark:text-white">
            &quot;{isEditing ? "수정" : "생성"}&quot;
          </strong>{" "}
          버튼을 눌러 문제를 {isEditing ? "수정" : "등록"}하세요.
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:gap-2 md:items-center">
          {isEditing && (
            <>
              <button
                onClick={async () => {
                  if (!editProblemId) return;
                  const confirmDelete = confirm(
                    "정말로 이 문제를 삭제하시겠습니까?",
                  );
                  if (!confirmDelete) return;
                  const { error } = await supabase
                    .from("problems")
                    .delete()
                    .eq("id", editProblemId);
                  if (error) {
                    toast.error("문제 삭제 중 오류가 발생했습니다.");
                  } else {
                    toast.success("문제가 삭제되었습니다.");
                    router.push(
                      `/organization/${params.organizationId}/problems`,
                    );
                    router.refresh();
                  }
                }}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition self-end md:self-auto"
              >
                삭제
              </button>
              <button
                onClick={openTransferModal}
                disabled={loadingTransfer}
                className={
                  "bg-yellow-500 text-white px-6 py-2 rounded-md hover:bg-yellow-600 transition self-end md:self-auto" +
                  (loadingTransfer ? " opacity-60 cursor-not-allowed" : "")
                }
              >
                조직 이동
              </button>
            </>
          )}
          <button
            disabled={loadingExisting || isSubmitting}
            className={
              "bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition self-end md:self-auto" +
              (loadingExisting || isSubmitting
                ? " opacity-60 cursor-not-allowed"
                : "")
            }
            onClick={async () => {
              if (isSubmitting) return; // guard double click

              setTouched({
                title: true,
                description: true,
                publishedAt: true,
                inputDescription: true,
                outputDescription: true,
                availableLanguages: true,
                grade: true,
                conditions: true,
                examples: true,
                deadline: hasDeadline ? true : false,
              });

              const currentErrors = computeErrors();
              setErrors(currentErrors);
              focusFirstError(currentErrors);
              // --- validations ---
              if (
                !title ||
                !description ||
                !publishedAt ||
                !inputDescription ||
                !outputDescription ||
                availableLanguages.length == 0 ||
                !grade
              ) {
                toast.error("모든 필수 정보를 입력하세요.", {
                  position: "top-right",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: false,
                  pauseOnHover: true,
                  draggable: true,
                  progress: undefined,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
                return;
              }

              if (!isValidDate(publishedAt)) {
                toast.error("유효한 날짜 및 시간을 입력하세요.", {
                  position: "top-right",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: false,
                  pauseOnHover: true,
                  draggable: true,
                  progress: undefined,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
                return;
              }

              if (hasDeadline && !isValidDate(deadline)) {
                toast.error("유효한 마감 기한을 입력하세요.", {
                  position: "top-right",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: false,
                  pauseOnHover: true,
                  draggable: true,
                  progress: undefined,
                  theme: theme === "dark" ? "dark" : "light",
                  transition: Bounce,
                });
                return;
              }

              setIsSubmitting(true);
              try {
                const payload = {
                  title,
                  description,
                  created_by: user?.id,
                  input_description: inputDescription,
                  output_description: outputDescription,
                  conditions,
                  sample_inputs: examplePairs.map((pair) => pair.input),
                  sample_outputs: examplePairs.map((pair) => pair.output),
                  published_at: new Date(publishedAt).toISOString(),
                  default_code: code,
                  time_limit: timeLimit,
                  memory_limit: memoryLimit,
                  organization_id: parseInt(params.organizationId),
                  deadline: hasDeadline
                    ? new Date(deadline).toISOString()
                    : null,
                  available_languages: availableLanguages,
                  grade: grade || null,
                  source: source.trim() || null,
                  tags: tags,
                };

                if (isEditing && editProblemId) {
                  const { error } = await supabase
                    .from("problems")
                    .update({
                      ...payload,
                    })
                    .eq("id", editProblemId);

                  if (error) {
                    toast.error("수정 중 오류가 발생했습니다.", {
                      position: "top-right",
                      autoClose: 3000,
                      hideProgressBar: true,
                      closeOnClick: true,
                      theme: theme === "dark" ? "dark" : "light",
                      transition: Bounce,
                    });
                  } else {
                    if (editProblemId && uploadedImages.length > 0) {
                      const rows = uploadedImages.map((img) => ({
                        problem_id: editProblemId,
                        url: img.url,
                        path: img.path,
                        section: img.section,
                      }));
                      const { error: assetsErr } = await supabase
                        .from("problem_assets")
                        .insert(rows);
                      if (assetsErr) {
                        toast.warn(
                          `이미지 기록 저장 실패: ${assetsErr.message}`,
                        );
                      }
                    }
                    toast.success("수정이 완료되었습니다.", {
                      position: "top-right",
                      autoClose: 1400,
                      hideProgressBar: true,
                      closeOnClick: true,
                      theme: theme === "dark" ? "dark" : "light",
                      transition: Bounce,
                    });
                  }
                } else {
                  const { data: createdRows, error } = await supabase
                    .from("problems")
                    .insert(payload)
                    .select("id");
                  if (error) {
                    toast.error("생성 중 오류가 발생했습니다.", {
                      position: "top-right",
                      autoClose: 3000,
                      hideProgressBar: true,
                      closeOnClick: true,
                      theme: theme === "dark" ? "dark" : "light",
                      transition: Bounce,
                    });
                  } else {
                    const createdId =
                      Array.isArray(createdRows) && createdRows[0]?.id
                        ? createdRows[0].id
                        : null;
                    // try to persist uploaded images if any
                    if (createdId && uploadedImages.length > 0) {
                      const rows = uploadedImages.map((img) => ({
                        problem_id: createdId,
                        url: img.url,
                        path: img.path,
                        section: img.section,
                      }));
                      const { error: assetsErr } = await supabase
                        .from("problem_assets")
                        .insert(rows);
                      if (assetsErr) {
                        // non-blocking warning
                        toast.warn(
                          `이미지 기록 저장 실패: ${assetsErr.message}`,
                        );
                      }
                    }
                    toast.success("문제가 생성되었습니다.", {
                      position: "top-right",
                      autoClose: 1400,
                      hideProgressBar: true,
                      closeOnClick: true,
                      theme: theme === "dark" ? "dark" : "light",
                      transition: Bounce,
                    });
                    router.push(
                      `/organization/${params.organizationId}/problems`,
                    );
                    router.refresh();
                  }
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="h-4 w-4 animate-spin"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    strokeWidth="4"
                    opacity="0.25"
                  />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="4" />
                </svg>
                {isEditing ? "수정 중..." : "생성 중..."}
              </span>
            ) : isEditing ? (
              "수정"
            ) : (
              "생성"
            )}
          </button>
        </div>
      </div>
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-black dark:text-white">
                문제 조직 이동
              </h2>
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              이동할 조직 선택
            </label>
            <select
              className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white"
              value={selectedTransferOrgId ?? ""}
              onChange={(e) =>
                setSelectedTransferOrgId(
                  e.target.value ? parseInt(e.target.value) : null,
                )
              }
            >
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} (#{org.id})
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-black dark:text-white"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default NewProblemPage;
