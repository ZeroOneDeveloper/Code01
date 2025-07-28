import { UserProfile } from "@lib/types";
import { createClient } from "@lib/supabase/server";

export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const getUserData = async (userId: string): Promise<UserProfile> => {
  if (!hasEnvVars) {
    throw new Error("Supabase environment variables are not set.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Error fetching user data: ${error.message}`);
  }

  return data;
};
