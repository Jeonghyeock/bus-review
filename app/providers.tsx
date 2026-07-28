"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { UserProvider } from "@/lib/supabase/useUser";

export default function Providers({ children }: { children: React.ReactNode }) {
  // 컴포넌트 트리마다 하나의 QueryClient 유지
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <UserProvider>{children}</UserProvider>
    </QueryClientProvider>
  );
}
