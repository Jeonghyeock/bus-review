"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

// 현재 URL(선택 상태 반영됨) 복사
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 실패 무시
    }
  };

  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
      aria-label="공유"
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? "복사됨" : "공유"}
    </button>
  );
}
