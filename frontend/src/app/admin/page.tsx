"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:6996';

interface Stats {
  players: number;
  rooms: number;
  activeGames: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timestamp: number;
}

interface Player {
  socketId: string;
  nickname: string;
  userId: string | null;
  score: number;
  room: string | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  playerCount: number;
  players: Array<{
    socketId: string;
    nickname: string;
    ready: boolean;
  }>;
  mode: string;
  game: {
    phase: string;
    round: number;
    totalRounds: number;
    creatorId: string;
    patternLength: number;
  } | null;
}

interface DBStats {
  enabled: boolean;
  totalUsers: number;
  totalResults: number;
  recentGames: Array<{
    nickname: string;
    percent: number;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<'readonly' | 'full' | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dbStats, setDbStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");

  // Verify token on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('admin_token');
    const storedMode = sessionStorage.getItem('admin_mode') as 'readonly' | 'full' | null;

    if (!storedToken || !storedMode) {
      router.push('/');
      return;
    }

    // Verify token with backend
    fetch(`${SOCKET_URL}/admin/verify`, {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    })
      .then(res => {
        if (!res.ok) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_mode');
          router.push('/');
        } else {
          setToken(storedToken);
          setMode(storedMode);
          setLoading(false);
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  // Fetch all data
  const fetchData = async () => {
    if (!token) return;

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [statsRes, playersRes, roomsRes, dbStatsRes] = await Promise.all([
        fetch(`${SOCKET_URL}/admin/stats`, { headers }),
        fetch(`${SOCKET_URL}/admin/players`, { headers }),
        fetch(`${SOCKET_URL}/admin/rooms`, { headers }),
        fetch(`${SOCKET_URL}/admin/db-stats`, { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (playersRes.ok) setPlayers(await playersRes.json());
      if (roomsRes.ok) setRooms(await roomsRes.json());
      if (dbStatsRes.ok) setDbStats(await dbStatsRes.json());
    } catch (e) {
      setError("Failed to fetch data");
    }
  };

  // Poll data every 2 seconds
  useEffect(() => {
    if (!token) return;

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [token]);

  // Admin actions
  const kickPlayer = async (socketId: string) => {
    if (mode !== 'full') return;

    const confirmed = confirm(`Kick player ${socketId}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${SOCKET_URL}/admin/kick-player`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ socketId }),
      });

      if (res.ok) {
        setActionMessage("Player kicked successfully");
        setTimeout(() => setActionMessage(""), 3000);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to kick player");
      }
    } catch (e) {
      setError("Connection error");
    }
  };

  const endGame = async (roomId: string) => {
    if (mode !== 'full') return;

    const confirmed = confirm(`End game in room ${roomId}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${SOCKET_URL}/admin/end-game`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      });

      if (res.ok) {
        setActionMessage("Game ended successfully");
        setTimeout(() => setActionMessage(""), 3000);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to end game");
      }
    } catch (e) {
      setError("Connection error");
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (mode !== 'full') return;

    const confirmed = confirm(`Delete room ${roomId}? All players will be disconnected.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${SOCKET_URL}/admin/delete-room`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      });

      if (res.ok) {
        setActionMessage("Room deleted successfully");
        setTimeout(() => setActionMessage(""), 3000);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete room");
      }
    } catch (e) {
      setError("Connection error");
    }
  };

  const clearLeaderboard = async () => {
    if (mode !== 'full') return;

    const confirmed = confirm("⚠️ WARNING: This will permanently delete ALL leaderboard data! Are you absolutely sure?");
    if (!confirmed) return;

    const doubleCheck = confirm("This action cannot be undone. Type 'DELETE' to confirm.");
    if (!doubleCheck) return;

    try {
      const res = await fetch(`${SOCKET_URL}/admin/clear-leaderboard`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setActionMessage("Leaderboard cleared successfully");
        setTimeout(() => setActionMessage(""), 3000);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to clear leaderboard");
      }
    } catch (e) {
      setError("Connection error");
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface grid place-items-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-3 w-full text-foreground flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-licorice tracking-tight">DupMe</h1>
          <span className="text-muted text-sm">Server Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
            mode === 'full' ? 'bg-green-900/30 text-green-200 border-green-500/50' : 'bg-blue-900/30 text-blue-200 border-blue-500/50'
          }`}>
            {mode === 'full' ? 'FULL ADMIN' : 'READ-ONLY'}
          </span>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_token');
              sessionStorage.removeItem('admin_mode');
              router.push('/');
            }}
            className="px-3 py-1.5 rounded-lg text-sm bg-red-800 text-white hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="flex-1 px-6 pb-6 pt-4 space-y-6 overflow-y-auto">
        {/* Messages */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-green-900/30 text-green-200 border border-green-500/50">{actionMessage}</div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-900/30 text-red-200 border border-red-500/50">{error}</div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
            <div className="text-sm text-muted mb-1">Players Online</div>
            <div className="text-4xl font-bold">{stats?.players || 0}</div>
          </div>
          <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
            <div className="text-sm text-muted mb-1">Total Rooms</div>
            <div className="text-4xl font-bold">{stats?.rooms || 0}</div>
          </div>
          <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
            <div className="text-sm text-muted mb-1">Active Games</div>
            <div className="text-4xl font-bold">{stats?.activeGames || 0}</div>
          </div>
          <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
            <div className="text-sm text-muted mb-1">Server Uptime</div>
            <div className="text-xl font-bold">{stats ? formatUptime(stats.uptime) : '-'}</div>
          </div>
        </div>

        {/* Server Metrics */}
        <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
          <h2 className="text-lg font-semibold mb-4">Server Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-muted text-xs mb-1">Heap Used</span>
              <span className="font-mono text-lg">{stats ? formatMemory(stats.memory.heapUsed) : '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted text-xs mb-1">Heap Total</span>
              <span className="font-mono text-lg">{stats ? formatMemory(stats.memory.heapTotal) : '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted text-xs mb-1">RSS</span>
              <span className="font-mono text-lg">{stats ? formatMemory(stats.memory.rss) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Rooms Table */}
        <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
          <h2 className="text-lg font-semibold mb-4">Active Rooms ({rooms.length})</h2>
          {rooms.length === 0 ? (
            <div className="text-muted text-sm p-4 text-center">No active rooms</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme">
                    <th className="text-left py-3 text-muted font-medium">Room ID</th>
                    <th className="text-left py-3 text-muted font-medium">Name</th>
                    <th className="text-left py-3 text-muted font-medium">Players</th>
                    <th className="text-left py-3 text-muted font-medium">Mode</th>
                    <th className="text-left py-3 text-muted font-medium">Status</th>
                    {mode === 'full' && <th className="text-left py-3 text-muted font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-theme/50 hover:bg-surface-muted/50 transition">
                      <td className="py-3 font-mono text-xs">{room.id}</td>
                      <td className="py-3">{room.name}</td>
                      <td className="py-3">{room.playerCount}/{room.capacity}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-lg bg-surface-muted text-xs">{room.mode}</span>
                      </td>
                      <td className="py-3">
                        {room.game ? (
                          <span className="text-xs">
                            <span className="text-muted">{room.game.phase}</span> · Round {room.game.round}/{room.game.totalRounds}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Waiting</span>
                        )}
                      </td>
                      {mode === 'full' && (
                        <td className="py-3">
                          <div className="flex gap-2">
                            {room.game && room.game.phase !== 'idle' && (
                              <button
                                onClick={() => endGame(room.id)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-orange-800 text-white hover:bg-orange-700 transition"
                              >
                                End Game
                              </button>
                            )}
                            <button
                              onClick={() => deleteRoom(room.id)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-red-800 text-white hover:bg-red-700 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Players Table */}
        <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
          <h2 className="text-lg font-semibold mb-4">Connected Players ({players.length})</h2>
          {players.length === 0 ? (
            <div className="text-muted text-sm p-4 text-center">No players online</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme">
                    <th className="text-left py-3 text-muted font-medium">Nickname</th>
                    <th className="text-left py-3 text-muted font-medium">Score</th>
                    <th className="text-left py-3 text-muted font-medium">Room</th>
                    <th className="text-left py-3 text-muted font-medium">Socket ID</th>
                    {mode === 'full' && <th className="text-left py-3 text-muted font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.socketId} className="border-b border-theme/50 hover:bg-surface-muted/50 transition">
                      <td className="py-3">{player.nickname}</td>
                      <td className="py-3">{player.score}%</td>
                      <td className="py-3 font-mono text-xs text-muted">{player.room || '-'}</td>
                      <td className="py-3 font-mono text-xs text-muted">{player.socketId.slice(0, 10)}...</td>
                      {mode === 'full' && (
                        <td className="py-3">
                          <button
                            onClick={() => kickPlayer(player.socketId)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-800 text-white hover:bg-red-700 transition"
                          >
                            Kick
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Database Stats */}
        {dbStats && dbStats.enabled && (
          <div className="p-5 rounded-2xl border border-theme bg-surface backdrop-blur-xl" style={{ boxShadow: 'var(--elev-shadow)' }}>
            <h2 className="text-lg font-semibold mb-4">Database Statistics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col">
                <span className="text-muted text-xs mb-1">Total Users</span>
                <span className="text-2xl font-bold">{dbStats.totalUsers}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted text-xs mb-1">Total Game Results</span>
                <span className="text-2xl font-bold">{dbStats.totalResults}</span>
              </div>
            </div>
            {mode === 'full' && (
              <div className="mt-6 p-4 border border-red-500/50 rounded-xl bg-red-900/20">
                <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
                <button
                  onClick={clearLeaderboard}
                  className="px-4 py-2 rounded-lg bg-red-800 text-white hover:bg-red-700 transition font-medium"
                >
                  Clear All Leaderboard Data
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
