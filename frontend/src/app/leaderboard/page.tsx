"use client";

import { useEffect, useState, useCallback } from 'react';

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

  const fetchBoards = useCallback(async () => {
    const [ra, rw] = await Promise.all([
      fetch(`${SOCKET_URL}/leaderboard?range=all`).then(r=>r.json()).catch(()=>[]),
      fetch(`${SOCKET_URL}/leaderboard?range=week`).then(r=>r.json()).catch(()=>[]),
    ]);
    setAllRows(Array.isArray(ra) ? ra : []);
    setWeekRows(Array.isArray(rw) ? rw : []);
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
      <circle cx="10" cy="10" r="8" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
      <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="3" fill="none"
        strokeDasharray={`30 50.265`} strokeLinecap="round" transform="rotate(-90 10 10)" />
    </svg>
  );

  return (
    <main className="min-h-screen p-6 w-full text-gray-100">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-7xl font-semibold mb-4">Leaderboard</h1>
        <div className="flex gap-2 mb-4 text-xs">
          <button onClick={()=>setTab('all')} className={tab==='all'? 'px-3 py-1 rounded bg-white/10' : 'px-3 py-1 rounded bg-white/5'}>All‑time</button>
          <button onClick={()=>setTab('week')} className={tab==='week'? 'px-3 py-1 rounded bg-white/10' : 'px-3 py-1 rounded bg-white/5'}>This week</button>
          <button onClick={()=>{ void fetchBoards(); void fetchMe(); }} className="ml-auto px-3 py-1 rounded bg-white/5">Refresh</button>
        </div>
        <div className="p-5 rounded-2xl bg-[#272725]">
          {rows.length === 0 ? (
            <div className="text-sm text-gray-300">
              No entries yet.
              <div className="mt-2 text-gray-400">
                Tip: Click Ready and finish a round. Scores are stored per device; use the same browser to build your record.
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <div className="grid grid-cols-6 gap-2 pb-2 border-b border-white/10 text-gray-300">
                <div>Player</div>
                <div className="text-right flex items-center justify-end gap-2"><MiniRing /> Best</div>
                <div className="text-right">Attempts@Best</div>
                <div className="text-right">Games</div>
                <div className="text-right">Total Att.</div>
                <div className="text-right">Last played</div>
              </div>
              <ul className="divide-y divide-white/10">
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

        <div className="mt-6 p-5 rounded-2xl bg-[#272725]">
          <h2 className="text-sm font-semibold mb-3">My stats</h2>
          {!meSummary ? (
            <div className="text-sm text-gray-300">No games recorded yet on this device.</div>
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
              <div className="text-xs text-gray-300">Last played: {new Date(meSummary.last_played).toLocaleString()}</div>
              {meRecent.length > 0 && (
                <div>
                  <div className="mt-3 mb-2 text-xs text-gray-300">Recent rounds</div>
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


