export interface UserProfile {
  id: string;
  is_admin: boolean;
  student_id: string;
  nickname: string;
  name: string;
  email: string;
  created_at: string;
}

export type Language = "python" | "java" | "c" | "cpp";

export interface Submission {
  id: string;
  user_id: string;
  problem_id: number;
  status_code: SubmissionStatus;
  code: string;
  stdout_list: string[];
  stderr_list: string[];
  time_ms: number;
  memory_kb: number;
  passed_all: boolean;
  is_correct: boolean;
  passed_time_limit: boolean;
  passed_memory_limit: boolean;
  submitted_at: string;
  visibility: "public" | "private" | "correct";
  cases_total: number;
  cases_done: number;
  language: string;
}

export interface Organization {
  id: number;
  name: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
}

export interface Problem {
  id: number;
  created_at: string;
  title: string;
  description: string;
  published_at: string;
  created_by: string;
  input_description: string;
  output_description: string;
  conditions: string[];
  sample_inputs: string[];
  sample_outputs: string[];
  default_code: string;
  time_limit: number;
  memory_limit: number;
  organization_id: number;
  deadline: string | null;
  grade: "expert" | "advanced" | "intermediate" | "beginner";
  available_languages: Language[];
  source: string | null;
  tags: string[] | null;
}

export interface TestCase {
  id: string;
  problem_id: number;
  title: string;
  input: string;
  output: string;
  created_at: string;
}

export enum SubmissionStatus {
  Pending = 0,
  Accepted = 1,
  WrongAnswer = 2,
  TimeLimitExceeded = 3,
  MemoryLimitExceeded = 4,
  RuntimeError = 5,
  CompilationError = 6,
  InternalError = 7,
}

export const toStatusKo = (code: number | string): string => {
  const n = typeof code === "number" ? code : Number(code);
  switch (n) {
    case SubmissionStatus.Pending:
      return "대기중";
    case SubmissionStatus.Accepted:
      return "정답";
    case SubmissionStatus.WrongAnswer:
      return "오답";
    case SubmissionStatus.TimeLimitExceeded:
      return "시간 초과";
    case SubmissionStatus.MemoryLimitExceeded:
      return "메모리 초과";
    case SubmissionStatus.RuntimeError:
      return "런타임 에러";
    case SubmissionStatus.CompilationError:
      return "컴파일 에러";
    case SubmissionStatus.InternalError:
      return "시스템 에러";
    default:
      return "알 수 없음";
  }
};

export const toGradeKo = (grade: Problem["grade"] | undefined): string => {
  switch (grade) {
    case "expert":
      return "최상급";
    case "advanced":
      return "상급";
    case "intermediate":
      return "중급";
    case "beginner":
      return "초급";
    default:
      return "-";
  }
};
