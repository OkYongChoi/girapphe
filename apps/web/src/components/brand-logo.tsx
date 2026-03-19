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
        <linearGradient id="stem-gradient" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M14 30l10-14 10 14" stroke="url(#stem-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 19h16" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="14" cy="30" r="3" fill="#0ea5e9" />
      <circle cx="24" cy="16" r="3" fill="#2563eb" />
      <circle cx="34" cy="30" r="3" fill="#0284c7" />
      <circle cx="24" cy="24" r="2.2" fill="#0f172a" />
    </svg>
  );
}
