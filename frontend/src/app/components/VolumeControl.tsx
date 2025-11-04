"use client";
import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

type VolumeControlProps = {
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
};

const VolumeControl: React.FC<VolumeControlProps> = ({ volume, setVolume }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const isMuted = volume === 0;

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Toggle slider visibility
  const toggleSlider = () => {
    setIsOpen(!isOpen);
  };

  // Mute/unmute toggle
  const handleMuteToggle = () => {
    setVolume(isMuted ? 0.5 : 0);
  };

  return (
    <div
      className="relative flex items-center"
      ref={containerRef}
    >
      {/* Volume Button - Click to open slider */}
      <button
        className={`control p-2 rounded-lg border border-theme transition-all ${
          isOpen ? 'bg-control-bg-hover ring-2 ring-border-color' : ''
        }`}
        aria-label={`Volume: ${Math.round(volume * 100)}%`}
        onClick={toggleSlider}
      >
        {isMuted ? (
          <VolumeX className="size-4 text-muted" />
        ) : (
          <Volume2 className="size-4 text-muted" />
        )}
      </button>

      {/* Vertical Slider Popup (appears on click) */}
      <div
        className={`absolute top-full -right-4 mt-4 bg-surface border border-theme rounded-lg shadow-lg p-3 transition-all duration-200 ${
          isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ zIndex: 50 }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Percentage Display */}
          <span className="text-xs font-medium text-muted">
            {Math.round(volume * 100)}%
          </span>

          {/* Vertical Slider Container with Visual Track */}
          <div className="relative flex items-center justify-center">
            {/* Background Track */}
            <div className="absolute h-24 w-2 rounded-full bg-track pointer-events-none" />

            {/* Filled Progress Bar (shows current volume) */}
            <div
              className="absolute bottom-0 w-2 rounded-full bg-progress pointer-events-none transition-all duration-100"
              style={{ height: `${volume * 100}%` }}
            />

            {/* Vertical Range Input (invisible but interactive) */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider h-24 w-8 relative z-10"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
              aria-label="Volume slider"
            />
          </div>

          {/* Mute/Unmute Button */}
          <button
            onClick={handleMuteToggle}
            className="control px-3 py-1.5 rounded-md border border-theme text-xs font-medium transition-all hover:scale-105 active:scale-95"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <span className="flex items-center gap-1.5">
                <VolumeX className="size-3" />
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Custom Slider Styling */}
      <style jsx>{`
        /* Track colors for visual progress bar */
        .bg-track {
          background: rgba(255, 255, 255, 0.15);
        }

        :root[data-theme="light"] .bg-track {
          background: rgba(0, 0, 0, 0.15);
        }

        .bg-progress {
          background: var(--color-fg);
          opacity: 0.8;
        }

        /* Make range input transparent so visual track shows through */
        .volume-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }

        /* Hide the default track (we're using custom visual elements) */
        .volume-slider::-webkit-slider-track {
          background: transparent;
          border: none;
        }

        .volume-slider::-moz-range-track {
          background: transparent;
          border: none;
        }

        /* Style the thumb (the draggable dot) */
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-fg);
          border: 2px solid var(--surface);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
        }

        .volume-slider::-webkit-slider-thumb:active {
          transform: scale(1.1);
        }

        .volume-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-fg);
          border: 2px solid var(--surface);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .volume-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
        }

        .volume-slider::-moz-range-thumb:active {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

export default VolumeControl;
