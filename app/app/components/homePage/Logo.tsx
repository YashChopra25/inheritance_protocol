export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="vw-grad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#b794ff" />
            <stop offset="100%" stopColor="#6c46ff" />
          </linearGradient>
          <linearGradient id="vw-grad-2" x1="0" y1="0" x2="0" y2="32">
            <stop offset="0%" stopColor="#9efce0" />
            <stop offset="100%" stopColor="#6c46ff" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="4"
          width="28"
          height="24"
          rx="6"
          fill="url(#vw-grad)"
          opacity="0.18"
        />
        <rect
          x="2"
          y="4"
          width="28"
          height="24"
          rx="6"
          stroke="url(#vw-grad)"
          strokeWidth="1.2"
        />
        <circle cx="16" cy="16" r="5.5" stroke="url(#vw-grad-2)" strokeWidth="1.4" />
        <circle cx="16" cy="16" r="1.6" fill="#9efce0" />
        <path
          d="M16 10.5v-2M16 23.5v-2M21.5 16h2M8.5 16h2"
          stroke="url(#vw-grad-2)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-semibold tracking-tight text-[15px]">
        Vault<span className="text-[var(--accent)]">Will</span>
      </span>
    </div>
  );
}
