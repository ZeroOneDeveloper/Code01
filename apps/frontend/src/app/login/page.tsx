import React from "react";
import { redirect } from "next/navigation";

import { createClient } from "@lib/supabase/server";

import LoginForm from "@components/hero/LoginForm";

const LoginPage: React.FC = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center w-full px-4 py-6">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
