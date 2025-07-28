export interface UserProfile {
  id: string;
  is_admin: boolean;
  student_id: string;
  name: string;
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
