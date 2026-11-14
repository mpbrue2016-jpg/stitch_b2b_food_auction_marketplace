'use client';

import React, { useState, useEffect } from 'react';

interface AuctionCountdownProps {
  terminaEm: string;
  size?: 'sm' | 'md' | 'lg';
  onExpire?: () => void;
}

export const AuctionCountdown: React.FC<AuctionCountdownProps> = ({
  terminaEm,
  size = 'md',
  onExpire,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    isCritical: boolean;
    isExpired: boolean;
  }>({
    hours: '00',
    minutes: '00',
    seconds: '00',
    isCritical: false,
    isExpired: false,
  });

  useEffect(() => {
    function calculate() {
      const difference = new Date(terminaEm).getTime() - new Date().getTime();

      if (difference <= 0) {
        setTimeLeft({
          hours: '00',
          minutes: '00',
          seconds: '00',
          isCritical: true,
          isExpired: true,
        });
        if (onExpire) onExpire();
        return;
      }

      const totalMinutes = Math.floor(difference / (1000 * 60));
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
        isCritical: totalMinutes < 15,
        isExpired: false,
      });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [terminaEm, onExpire]);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-bold',
    lg: 'text-xl font-extrabold',
  }[size];

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-outline font-bold text-xs bg-surface-container px-2 py-0.5 rounded">
        <span className="material-symbols-outlined text-[14px]">lock_clock</span>
        PREGÃO ENCERRADO
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 tnum ${sizeClasses} ${
        timeLeft.isCritical
          ? 'text-tertiary bg-tertiary-fixed/40 px-2 py-0.5 rounded border border-tertiary/20'
          : 'text-primary bg-primary-fixed/40 px-2 py-0.5 rounded'
      }`}
      title="Tempo restante de disputa"
    >
      <span
        className={`material-symbols-outlined text-[16px] ${
          timeLeft.isCritical ? 'animate-pulse text-tertiary' : ''
        }`}
      >
        timer
      </span>
      <span>
        {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
      </span>
    </div>
  );
};
