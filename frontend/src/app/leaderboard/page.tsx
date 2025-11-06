"use client";

import { useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:6996';

type LeaderRow = {
  user_id: string;
  nickname: string;
  best: number;
  attempts_at_best: number;
  games_played: number;
  total_attempts: number;
  total_correct: number;
  last_played: string;
};
type MeSummary = LeaderRow | null;
type MeRecent = Array<{ nickname: string; percent: number; attempts: number; correct: number; created_at: string }>;

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'all'|'week'>('all');
  const [allRows, setAllRows] = useState<LeaderRow[]>([]);
  const [weekRows, setWeekRows] = useState<LeaderRow[]>([]);
  const [meSummary, setMeSummary] = useState<MeSummary>(null);
  const [meRecent, setMeRecent] = useState<MeRecent>([]);
  const [loading, setLoading] = useState(true);

  // Theme state (sync with html[data-theme])
  const [theme, setTheme] = useState<'dark'|'light'>(() => 'dark');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dupme_theme');
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const effective = (saved === 'light' || saved === 'dark') ? (saved as 'light'|'dark') : current;
      setTheme(effective);
      if (effective === 'light') html.setAttribute('data-theme', 'light'); else html.removeAttribute('data-theme');
    } catch {}
  }, []);
  const toggleTheme = () => {
    const next: 'dark'|'light' = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem('dupme_theme', next); } catch {}
    const html = document.documentElement;
    if (next === 'light') html.setAttribute('data-theme', 'light'); else html.removeAttribute('data-theme');
  };

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    const [ra, rw] = await Promise.all([
      fetch(`${SOCKET_URL}/leaderboard?range=all`).then(r=>r.json()).catch(()=>[]),
      fetch(`${SOCKET_URL}/leaderboard?range=week`).then(r=>r.json()).catch(()=>[]),
    ]);
    setAllRows(Array.isArray(ra) ? ra : []);
    setWeekRows(Array.isArray(rw) ? rw : []);
    setLoading(false);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const uid = typeof window !== 'undefined' ? (localStorage.getItem('dupme_uid') || '') : '';
      if (!uid) { setMeSummary(null); setMeRecent([]); return; }
      const res = await fetch(`${SOCKET_URL}/leaderboard/me?userId=${encodeURIComponent(uid)}`).then(r=>r.json()).catch(()=>({ summary:null, recent:[] }));
      setMeSummary(res?.summary || null);
      setMeRecent(Array.isArray(res?.recent) ? res.recent : []);
    } catch { setMeSummary(null); setMeRecent([]); }
  }, []);

  useEffect(() => { void fetchBoards(); void fetchMe(); }, [fetchBoards, fetchMe]);

  const rows = tab==='all' ? allRows : weekRows;

  const MiniRing = () => (
    <svg width="12" height="12" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" stroke="currentColor" opacity="0.25" strokeWidth="3" fill="none" />
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="3" fill="none"
        strokeDasharray={`30 50.265`} strokeLinecap="round" transform="rotate(-90 10 10)" />
    </svg>
  );

  const LoadingSkeleton = () => (
    <div className="flex flex-col items-center justify-center py-12 text-muted">
      <svg
        width="48"
        height="48"
        viewBox="0 0 32 32"
        className="mb-4 animate-pulse"
        style={{
          animation: 'float 2s ease-in-out infinite, pulse 2s ease-in-out infinite',
        }}
      >
        <circle cx="11" cy="22" r="3.2" fill="currentColor" opacity="0.6" />
        <rect x="14.2" y="9" width="2.4" height="13" rx="1.2" fill="currentColor" opacity="0.6" />
        <path
          d="M16.6 9 C18.2 9 20.5 8.5 22 7.5 C22.8 7 23.5 6.2 23.8 5.2 C24 4.5 23.9 3.8 23.5 3.2 C23 2.5 22.2 2.2 21.4 2.4 C20.5 2.6 19.8 3.3 19.5 4.1 C19.2 5 19.2 6 19.5 6.9 L16.6 9 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
      <p className="text-sm">Loading leaderboard data...</p>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );

  return (
    <main className="min-h-screen p-6 w-full text-foreground">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-7xl font-semibold mb-4">Leaderboard</h1>
        <div className="flex gap-2 mb-4 text-xs items-center">
          <button onClick={()=>setTab('all')} className={tab==='all'? 'px-3 py-1 rounded control border' : 'px-3 py-1 rounded'}>All‑time</button>
          <button onClick={()=>setTab('week')} className={tab==='week'? 'px-3 py-1 rounded control border' : 'px-3 py-1 rounded'}>This week</button>
          <button
            type="button"
            aria-label="Toggle theme"
            aria-pressed={theme === 'light'}
            onClick={toggleTheme}
            className="ml-auto px-2 py-1 rounded inline-flex items-center gap-1 control border"
            title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          >
            {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
            <span className="hidden sm:inline">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
          <button onClick={()=>{ void fetchBoards(); void fetchMe(); }} className="px-3 py-1 rounded control border">Refresh</button>
        </div>
        <div className="p-5 rounded-2xl bg-surface border border-theme">
          {loading ? (
            <LoadingSkeleton />
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted">
              No entries yet.
              <div className="mt-2 text-muted">
                Tip: Click Ready and finish a round. Scores are stored per device; use the same browser to build your record.
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <div className="grid grid-cols-6 gap-2 pb-2 border-b border-theme text-muted">
                <div>Player</div>
                <div className="text-right flex items-center justify-end gap-2 text-muted"><MiniRing /> Best</div>
                <div className="text-right">Attempts@Best</div>
                <div className="text-right">Games</div>
                <div className="text-right">Total Att.</div>
                <div className="text-right">Last played</div>
              </div>
              <ul className="divide-theme">
                {rows.map((r, i) => (
                  <li key={r.user_id+i} className="grid grid-cols-6 gap-2 py-2">
                    <div className="truncate" title={r.nickname}>{r.nickname || r.user_id.slice(0,6)}</div>
                    <div className="text-right">{r.best}%</div>
                    <div className="text-right">{r.attempts_at_best}</div>
                    <div className="text-right">{r.games_played}</div>
                    <div className="text-right">{r.total_attempts}</div>
                    <div className="text-right">{new Date(r.last_played).toLocaleDateString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 p-5 rounded-2xl bg-surface border border-theme">
          <h2 className="text-sm font-semibold mb-3">My stats</h2>
          {loading ? (
            <LoadingSkeleton />
          ) : !meSummary ? (
            <div className="text-sm text-muted">No games recorded yet on this device.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-5 gap-2">
                <div>Best</div><div className="text-right">{meSummary.best}%</div>
                <div className="col-span-2 text-right">Attempts@Best</div><div className="text-right">{meSummary.attempts_at_best}</div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div>Games</div><div className="text-right">{meSummary.games_played}</div>
                <div>Total Correct</div><div className="text-right">{meSummary.total_correct}</div>
                <div>Total Attempts</div><div className="text-right">{meSummary.total_attempts}</div>
              </div>
              <div className="text-xs text-muted">Last played: {new Date(meSummary.last_played).toLocaleString()}</div>
              {meRecent.length > 0 && (
                <div>
                  <div className="mt-3 mb-2 text-xs text-muted">Recent rounds</div>
                  <ul className="space-y-1 text-sm">
                    {meRecent.map((r, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        <span>{r.percent}% · {r.attempts} att.</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


