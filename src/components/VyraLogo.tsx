interface Props { size?: number; className?: string }
export function VyraLogo({ size = 48, className = "" }: Props) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vyra-grad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#7B3FF2" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#vyra-grad)" />
        <path d="M14 16 L24 34 L34 16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span style={{ fontSize: size * 0.55, fontWeight: 800, letterSpacing: "0.05em" }}>VYRA</span>
    </div>
  );
}
