export type User = {
  id: string;
  email: string | null;
  is_admin?: boolean;
  student_id?: string | null;
  name?: string | null;
  nickname?: string | null;
  created_at?: string;
};

export type RealtimePostgresChangesPayload<T> = {
  schema: string;
  table: string;
  eventType: string;
  new: T | null;
  old: T | null;
};

export type SupabaseLikeError = {
  message: string;
};
