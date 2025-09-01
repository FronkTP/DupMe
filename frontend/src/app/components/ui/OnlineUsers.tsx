"use client";

type OnlineUser = { id: string; nickname: string | null; score: number };

type OnlineUsersProps = {
  users: OnlineUser[];
};

export default function OnlineUsers({ users }: OnlineUsersProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="hidden sm:block">Online</div>
      <div className="flex -space-x-2">
        {users.slice(0, 6).map((u) => (
          <div
            key={u.id}
            title={`${u.nickname || u.id.slice(0,4)} — ${u.score}%`}
            className="h-6 w-6 rounded-full text-gray-800 bg-neutral-200 border border-white text-[10px] grid place-items-center"
          >
            {(u.nickname || u.id.slice(0, 2)).slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>
      {users.length > 6 && (
        <div className="h-6 w-6 rounded-full bg-neutral-200 border border-white text-[10px] grid place-items-center text-neutral-700">+{users.length - 6}</div>
      )}
    </div>
  );
}


