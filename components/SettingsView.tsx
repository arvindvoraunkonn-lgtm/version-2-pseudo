'use client';

import React from 'react';

export interface ThemeSettings {
  darkMode: boolean;
  bgColor: string;
  textColor: string;
}

interface SettingsViewProps {
  jasmineEnabled: boolean;
  daisyEnabled: boolean;
  onToggleJasmine: (enabled: boolean) => void;
  onToggleDaisy: (enabled: boolean) => void;
  theme: ThemeSettings;
  onThemeChange: (theme: ThemeSettings) => void;
}

export function SettingsView({
  jasmineEnabled,
  daisyEnabled,
  onToggleJasmine,
  onToggleDaisy,
  theme,
  onThemeChange,
}: SettingsViewProps) {
  return (
    <div className="w-full max-w-md mx-auto p-3 text-xs space-y-6">
      <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>Settings</span>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
          Features
        </div>

        {/* JASmine */}
        <div className="flex items-center justify-between py-2">
          <span className="font-medium" style={{ color: 'var(--text)' }}>JASmine</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggleJasmine(true)}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                jasmineEnabled ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={jasmineEnabled ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => onToggleJasmine(false)}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                !jasmineEnabled ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={!jasmineEnabled ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              Off
            </button>
          </div>
        </div>

        {/* DAISY */}
        <div className="flex items-center justify-between py-2">
          <span className="font-medium" style={{ color: 'var(--text)' }}>DAISY</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggleDaisy(true)}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                daisyEnabled ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={daisyEnabled ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => onToggleDaisy(false)}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                !daisyEnabled ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={!daisyEnabled ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
          Appearance
        </div>

        {/* Dark mode */}
        <div className="flex items-center justify-between py-2">
          <span className="font-medium" style={{ color: 'var(--text)' }}>Dark mode</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onThemeChange({ ...theme, darkMode: true })}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                theme.darkMode ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={theme.darkMode ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => onThemeChange({ ...theme, darkMode: false })}
              className={`px-3 py-1 text-[11px] rounded-[3px] cursor-pointer whitespace-nowrap ${
                !theme.darkMode ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'border'
              }`}
              style={!theme.darkMode ? {} : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
            >
              Off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
