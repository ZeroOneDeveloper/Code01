export interface UserProfile {
  id: string;
  is_admin: boolean;
  student_id: string;
  nickname: string;
  name: string;
}

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
