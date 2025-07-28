import React from "react";
import { redirect } from "next/navigation";

import { createClient } from "@lib/supabase/server";

import LoginForm from "@components/LoginForm";

const LoginPage: React.FC = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center w-full">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
