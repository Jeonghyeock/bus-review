"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Stop } from "@/lib/bus/types";
import { useStopSearch } from "@/lib/query/useStopSearch";

export default function SearchBar({ onSelect }: { onSelect: (stop: Stop) => void }) {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results, isFetching } = useStopSearch(debounced);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 shadow-lg">
        <Search size={18} className="shrink-0 text-gray-400" />
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="정류소 검색"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              setDebounced("");
            }}
            className="shrink-0 text-gray-300 hover:text-gray-500"
            aria-label="지우기"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-lg">
          {isFetching && !results && (
            <li className="px-4 py-3 text-sm text-gray-400">검색 중…</li>
          )}
          {results?.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">결과가 없어요</li>}
          {results?.map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
                onClick={() => {
                  onSelect(s);
                  setInput(s.name);
                  setOpen(false);
                }}
              >
                <span className="truncate text-sm text-gray-800">{s.name}</span>
                {s.stationNo && <span className="shrink-0 text-xs text-gray-400">{s.stationNo}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
