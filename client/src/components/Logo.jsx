const Logo = ({ className = "h-10" }) => (
  <svg
    viewBox="0 0 260 56"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    {/* Icon */}
    <g transform="translate(4 4)">
      {/* Outer ring */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="3"
      />

      {/* Inner ring */}
      <circle
        cx="24"
        cy="24"
        r="12"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.7"
      />

      {/* Center hub */}
      <circle
        cx="24"
        cy="24"
        r="4"
        fill="var(--color-accent)"
      />

      {/* Rim spokes */}
      <path
        d="M24 8V18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M24 30V40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M8 24H18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M30 24H40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M13.5 13.5L19 19"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M29 29L34.5 34.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M34.5 13.5L29 19"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M19 29L13.5 34.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Motion lines */}
      <path
        d="M0 16H10"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M-4 24H8"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M0 32H10"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>

    {/* Brand Name */}
    <text
      x="62"
      y="35"
      fontFamily="Space Grotesk, Inter, sans-serif"
      fontWeight="800"
      fontSize="28"
      letterSpacing="-0.8"
      fill="currentColor"
    >
      Road
      <tspan fill="var(--color-accent)">Wheels</tspan>
    </text>

    {/* Tagline */}
    <text
      x="64"
      y="48"
      fontFamily="Inter, sans-serif"
      fontWeight="500"
      fontSize="8"
      letterSpacing="2"
      fill="currentColor"
      opacity="0.6"
    >
      RENT • DRIVE • EXPLORE
    </text>
  </svg>
);

export default Logo;