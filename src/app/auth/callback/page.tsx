"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const completeAuth = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        setMessage("Sign-in failed. Please try again.");
        return;
      }
      router.replace("/");
    };

    completeAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-slate-600">
      {message}
    </div>
  );
}
