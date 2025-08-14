export interface UserProfile {
  id: string;
  is_admin: boolean;
  student_id: string;
  nickname: string;
  name: string;
  email: string;
  created_at: string;
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
  cases_total: number;
  cases_done: number;
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
  deadline?: string | null;
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
