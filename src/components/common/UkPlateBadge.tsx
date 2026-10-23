import React from 'react';

interface UkPlateBadgeProps {
  vrm: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onChange?: (nextVrm: string) => void;
  placeholder?: string;
}

export const UkPlateBadge: React.FC<UkPlateBadgeProps> = ({
  vrm,
  size = 'md',
  editable = false,
  onChange,
  placeholder = 'SH64 WRF',
}) => {
  const heightClass =
    size === 'sm' ? 'h-8 text-sm' : size === 'lg' ? 'h-14 text-2xl sm:text-3xl' : 'h-11 text-lg';
  const stripWidth = size === 'sm' ? 'w-5' : size === 'lg' ? 'w-9' : 'w-7';

  return (
    <div
      className={`inline-flex items-stretch rounded-md overflow-hidden border-2 border-slate-950 shadow-[0_0_0_2px_#FFCC00] bg-[#FFCC00] select-none ${heightClass}`}
    >
      {/* Blue UK Left Strip */}
      <div
        className={`${stripWidth} bg-[#003399] text-white flex flex-col items-center justify-center px-0.5 leading-none`}
      >
        <span className="text-[7px] font-bold tracking-tighter opacity-90">🇬🇧</span>
        <span className="text-[9px] font-black tracking-tighter mt-0.5">UK</span>
      </div>

      {/* Main Yellow Reflective Surface */}
      {editable ? (
        <input
          type="text"
          value={vrm}
          onChange={(e) => onChange?.(e.target.value.toUpperCase())}
          placeholder={placeholder}
          maxLength={9}
          aria-label="UK Registration Plate VRM"
          className="bg-[#FFCC00] text-slate-950 placeholder:text-slate-700/50 font-black tracking-[0.14em] uppercase px-3 w-44 sm:w-52 text-center focus:outline-none font-mono"
        />
      ) : (
        <div className="px-3 flex items-center justify-center text-slate-950 font-black tracking-[0.14em] uppercase font-mono">
          {vrm || 'UNKNOWN'}
        </div>
      )}
    </div>
  );
};
