/** Bloom's mascot: a little flower with a friendly face. */
export default function BloomFlower({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
    >
      {[0, 60, 120, 180, 240, 300].map((angle, index) => (
        <ellipse
          key={angle}
          cx="50"
          cy="22"
          rx="17"
          ry="22"
          fill={index % 2 ? "#ff9dbd" : "#f0608f"}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="21" fill="#ffd66b" />
      <circle cx="42.5" cy="47" r="2.8" fill="#4a2a3f" />
      <circle cx="57.5" cy="47" r="2.8" fill="#4a2a3f" />
      <path d="M42 55 Q50 62.5 58 55" stroke="#4a2a3f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="37.5" cy="53.5" r="3" fill="#ff9d8a" opacity="0.7" />
      <circle cx="62.5" cy="53.5" r="3" fill="#ff9d8a" opacity="0.7" />
    </svg>
  );
}
