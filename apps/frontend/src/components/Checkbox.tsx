import React from "react";
import { motion } from "framer-motion";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
}

const tickVariants = {
  checked: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.2, delay: 0.1 },
  },
  unchecked: {
    pathLength: 0,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export default function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="inline-flex items-center cursor-pointer gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <motion.span
        className="w-6 h-6 rounded-md border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-white dark:bg-gray-800"
        animate={{
          scale: checked ? 1.1 : 1,
          borderColor: checked ? "#10b981" : "#d1d5db",
          backgroundColor: checked ? "#10b981" : "#fff",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="white"
          className="w-4 h-4"
          initial={false}
          animate={checked ? "checked" : "unchecked"}
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            variants={tickVariants}
          />
        </motion.svg>
      </motion.span>
      {label && (
        <span className="ml-2 text-gray-700 dark:text-gray-300 select-none">
          {label}
        </span>
      )}
    </label>
  );
}
