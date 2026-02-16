"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ThemeToggle from "./theme-toggle";

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
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          prompt: "select_account"
        }
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Smart Bookmark App
          </p>
          <h1 className="font-display text-4xl font-semibold">
            Your bookmark vault
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)]">
            Save links with context, keep them private, and stay synced across
            tabs in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {userId ? (
            <button
              onClick={handleLogout}
              className="flex h-10 items-center rounded-full border border-[color:var(--border)] px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text)] transition hover:bg-[color:var(--surface-2)]"
            >
              Log out
            </button>
          ) : null}
        </div>
      </div>

      {!hasEnv ? (
        <div className="mt-8 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-900">
          Missing Supabase config. Add `NEXT_PUBLIC_SUPABASE_URL` and
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200/70 bg-red-50/80 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!sessionLoaded ? (
        <div className="mt-10 text-[color:var(--muted)]">
          Checking session...
        </div>
      ) : userId ? (
        <div className="mt-10">
          <form
            onSubmit={handleAdd}
            className="grid gap-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                URL
              </label>
              <input
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3 text-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ring)]"
                placeholder="https://example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Title
              </label>
              <input
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3 text-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ring)]"
                placeholder="Example"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[color:var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--bg)] transition hover:bg-[color:var(--accent-2)] disabled:opacity-60"
            >
              {loading ? "Adding..." : "Add bookmark"}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            {bookmarks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)]">
                No bookmarks yet. Add your first one above.
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex min-h-[120px] flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-24px_rgba(0,0,0,0.7)]"
                >
                  <div className="space-y-1">
                    <p className="text-xs text-[color:var(--muted)]">
                      {bookmark.url}
                    </p>
                    <p className="font-medium">{bookmark.title}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="mt-auto w-fit rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.7)]">
          <p className="text-[color:var(--muted)]">
            Sign in with Google to manage your private bookmarks.
          </p>
          <button
            onClick={handleLogin}
            className="mt-4 rounded-full bg-[color:var(--accent)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--bg)] transition hover:bg-[color:var(--accent-2)]"
          >
            Continue with Google
          </button>
        </div>
      )}
    </main>
  );
}
