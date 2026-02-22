import React from "react";

const WelcomePage: React.FC = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">가입을 축하드립니다!</h1>
        <p className="mt-4 text-xl">
          이메일 인증 링크를 보냈습니다. 링크를 눌러 인증을 완료해 주세요.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          인증 전에는 로그인할 수 없으며, 메일이 보이지 않으면 스팸함도 확인해
          주세요.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
