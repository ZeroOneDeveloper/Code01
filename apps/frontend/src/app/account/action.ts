"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@lib/supabase/server";

export async function updateUserProfile(
  student_id: string,
  nickname: string,
  name: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const { error } = await supabase
    .from("users")
    .update({ student_id, nickname, name })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
