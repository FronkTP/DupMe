'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const philosophicalTexts = [
  "In silence, we find the rhythm of existence...",
  "Every pattern begins with a single note...",
  "The server dreams in electric pulses...",
  "Waiting is just another form of becoming...",
  "Between the bits, infinity resides...",
  "Loading the architecture of memory...",
  "Time flows differently in the machine...",
];

export function AdminLoadingScreen() {
  const logoRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [philosophicalText] = useState(() =>
    philosophicalTexts[Math.floor(Math.random() * philosophicalTexts.length)]
  );

  useEffect(() => {
    const logo = logoRef.current;
    const text = textRef.current;

    if (!logo || !text) return;

    // Initial states
    gsap.set(logo, { scale: 0.8, opacity: 0 });
    gsap.set(text, { y: 20, opacity: 0 });

    // Create entrance timeline
    const tl = gsap.timeline();

    // Logo fade in and subtle scale
    tl.to(logo, {
      scale: 1,
      opacity: 1,
      duration: 1,
      ease: 'power2.out',
    });

    // Text fade in
    tl.to(text, {
      y: 0,
      opacity: 1,
      duration: 0.8,
      ease: 'power2.out',
    }, '-=0.5');

    // Continuous subtle float animation for logo
    gsap.to(logo, {
      y: -10,
      duration: 2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Subtle rotation animation
    gsap.to(logo, {
      rotation: 5,
      duration: 3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Music Note SVG */}
        <svg
          ref={logoRef}
          width="80"
          height="80"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-8"
        >
          {/* Bottom note head */}
          <circle cx="11" cy="22" r="3.2" fill="#e5e7eb" />

          {/* Vertical stem */}
          <rect x="14.2" y="9" width="2.4" height="13" rx="1.2" fill="#e5e7eb" />

          {/* Top note flag */}
          <path d="M16.6 9 C18 8.5, 21 7, 23 9.5 C25 12, 23.5 14, 21 14.5 C19 15, 17.5 14, 16.6 12.5 Z" fill="#e5e7eb" />

          {/* Small accent circle */}
          <circle cx="22" cy="11" r="1.5" fill="#272725" opacity="0.3" />
        </svg>

        {/* Text */}
        <div ref={textRef} className="text-center space-y-3 max-w-md px-6">
          <p className="text-gray-400 text-sm font-serif italic">
            {philosophicalText}
          </p>

          {/* Minimal loading indicator */}
          <div className="flex gap-1.5 justify-center mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.5s',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
