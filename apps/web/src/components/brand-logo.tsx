import type { SVGProps } from 'react';

type BrandLogoProps = {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
};

export default function BrandLogo({ className = '', textClassName = '', iconClassName = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <LogoMark className={iconClassName} />
      <span className={`font-bold tracking-tight text-slate-900 ${textClassName}`.trim()}>
        STEM<span className="text-sky-600">Brain</span>
      </span>
    </span>
  );
}

function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="stem-bg" x1="6" y1="43" x2="42" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#020617" />
          <stop offset="0.52" stopColor="#0f172a" />
          <stop offset="1" stopColor="#123b67" />
        </linearGradient>
        <linearGradient id="stem-edge" x1="9" y1="40" x2="40" y2="7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#a7f3d0" />
        </linearGradient>
        <linearGradient id="stem-core" x1="18" y1="31" x2="30" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="0.5" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="43" height="43" rx="10.5" fill="url(#stem-bg)" />
      <rect x="4.5" y="4.5" width="39" height="39" rx="9" fill="none" stroke="url(#stem-edge)" strokeWidth="1.8" />
      <path d="M9.5 31.5 18.8 16 29.5 31.2 38.5 16.2" stroke="#020617" strokeOpacity="0.42" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 31.5 18.8 16 29.5 31.2 38.5 16.2" stroke="url(#stem-edge)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 23h18" stroke="#e0f2fe" strokeWidth="2.7" strokeLinecap="round" />
      <circle cx="9.5" cy="31.5" r="3.8" fill="#22d3ee" />
      <circle cx="18.8" cy="16" r="4" fill="#60a5fa" />
      <circle cx="29.5" cy="31.2" r="4" fill="#34d399" />
      <circle cx="38.5" cy="16.2" r="3.8" fill="#a7f3d0" />
      <circle cx="24" cy="24" r="5.6" fill="url(#stem-core)" stroke="#e0f2fe" strokeWidth="1.2" />
      <path d="M21.4 23.5h5.2M24 21v6.2" stroke="#eff6ff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
