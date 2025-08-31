"use client";

// An array representing the notes on our piano
const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export default function Piano({ onKeyClick, disabled } : { onKeyClick: (note: string) => void, disabled?: boolean }) {
  
  const handleKeyClick = (note: string) => {
    if (disabled) return;
    // This function will now call the prop passed down from the parent page.
    if (onKeyClick) {
      onKeyClick(note);
    }
  };

  return (
    <div className="flex justify-center p-4 bg-gray-800 rounded-lg shadow-lg">
      {notes.map((note) => (
        <div 
          key={note}
          onClick={() => handleKeyClick(note)}
          className="w-16 h-48 m-1 bg-white rounded-lg border-b-8 border-gray-300 flex items-end justify-center pb-4
                     cursor-pointer select-none transition-all duration-100 ease-in-out
                     hover:bg-gray-200 active:border-b-2 active:h-44 active:mt-1"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        >
          <span className="text-2xl font-bold text-gray-700">{note}</span>
        </div>
      ))}
    </div>
  );
}

