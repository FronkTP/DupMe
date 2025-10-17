import React from "react";

type VolumeControlProps = {
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
};

const VolumeControl: React.FC<VolumeControlProps> = ({ volume, setVolume }) => {
  const decreaseVolume = () => setVolume((prev) => Math.max(0, prev - 0.1));
  const increaseVolume = () => setVolume((prev) => Math.min(1, prev + 0.1));

  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={decreaseVolume} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
        🔉
      </button>
      <span className="text-lg font-medium">{Math.round(volume * 100)}%</span>
      <button onClick={increaseVolume} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
        🔊
      </button>
    </div>
  );
};

export default VolumeControl;
