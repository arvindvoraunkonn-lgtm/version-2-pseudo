'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, X, Volume2, VolumeX } from 'lucide-react';

export interface AudioPlaybackState {
  src: string;
  title: string;
  subTitle?: string;
}

interface AudioPlayerProps {
  currentTrack: AudioPlaybackState | null;
  onClose: () => void;
}

export function AudioPlayer({ currentTrack, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack || !currentTrack.src) {
      audio.pause();
      return;
    }
    audio.src = currentTrack.src;
    audio.load();
    audio.play().catch(() => {});
  }, [currentTrack]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="w-full bg-[var(--bg-hover)] border-b border-[var(--border)] px-2 py-1 text-xs">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={togglePlay}
            className="p-1 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] cursor-pointer hover:bg-[var(--bg-hover)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3 h-3 text-[var(--text)]" /> : <Play className="w-3 h-3 text-[var(--text)]" />}
          </button>
          <div className="truncate text-[11px] leading-tight">
            <span className="font-medium text-[var(--text)]">{currentTrack.title}</span>
            {currentTrack.subTitle && (
              <span className="text-[var(--text-muted)] ml-1">({currentTrack.subTitle})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="mt-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-[var(--border-light)] accent-[var(--accent)] cursor-pointer block"
        />
      </div>
    </div>
  );
}
