"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Bookmark = {
  id: string;
  url: string;
  title: string;
  created_at: string;
};

export default function HomePage() {
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasEnv = useMemo(() => {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const currentUserId = data.session?.user.id ?? null;
      setUserId(currentUserId);
      setSessionLoaded(true);
    };

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setBookmarks([]);
      return;
    }

    let isMounted = true;

    const load = async () => {
      const { data, error: loadError } = await supabase
        .from("bookmarks")
        .select("id, url, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setError(null);
      setBookmarks(data ?? []);
    };

    load();

    const channel = supabase
      .channel("bookmarks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${userId}`
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleLogin = async () => {
    setError(null);
    if (!hasEnv) {
      setError("Missing Supabase env vars. See README setup steps.");
      return;
    }

    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });

    if (signInError) setError(signInError.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!userId) return;
    if (!url.trim() || !title.trim()) {
      setError("Please provide both a URL and a title.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("bookmarks").insert({
      user_id: userId,
      url: url.trim(),
      title: title.trim()
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setUrl("");
    setTitle("");
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const { error: deleteError } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);
    if (deleteError) setError(deleteError.message);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">
            Smart Bookmark App
          </p>
          <h1 className="text-3xl font-semibold">Your bookmarks</h1>
        </div>
        {userId ? (
          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Log out
          </button>
        ) : null}
      </div>

      {!hasEnv ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing Supabase config. Add `NEXT_PUBLIC_SUPABASE_URL` and
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!sessionLoaded ? (
        <div className="mt-10 text-slate-600">Checking session...</div>
      ) : userId ? (
        <div className="mt-10">
          <form
            onSubmit={handleAdd}
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-600">URL</label>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="https://example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-600">Title</label>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Example"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Adding..." : "Add bookmark"}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            {bookmarks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                No bookmarks yet. Add your first one above.
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="text-sm text-slate-500">{bookmark.url}</p>
                    <p className="font-medium">{bookmark.title}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-600">
            Sign in with Google to manage your private bookmarks.
          </p>
          <button
            onClick={handleLogin}
            className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue with Google
          </button>
        </div>
      )}
    </main>
  );
}
