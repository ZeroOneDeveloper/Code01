import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <footer className="mt-10 w-full flex justify-between items-center py-4 px-8">
      <p className="text-left text-xl text-gray-500">
        © 2025 Code01. All rights reserved.
      </p>
      <p className="text-right text-xl text-gray-500">
        developed by{" "}
        <Link className="underline" href="https://github.com/ZeroOneDeveloper/">
          Chanwoo Song
        </Link>
      </p>
    </footer>
  );
};

export default Footer;
