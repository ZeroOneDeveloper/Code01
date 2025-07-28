import React from "react";

const WelcomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">가입을 축하드립니다!</h1>
        <p className="mt-4 text-xl">
          가입 확인 이메일을 발송했습니다. 메일함을 확인하신 후 인증을 완료해
          주세요.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
