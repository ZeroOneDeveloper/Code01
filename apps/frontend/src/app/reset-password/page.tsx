import React, { Suspense } from "react";

import ResetPasswordForm from "@components/hero/ResetPasswordForm";

const ResetPasswordPage = () => {
  return (
    <div className="flex flex-1 items-center justify-center w-full px-4 py-6">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
};

export default ResetPasswordPage;
