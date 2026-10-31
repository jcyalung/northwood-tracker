// Falling confetti that fills its nearest `relative` parent, behind the
// content. Text in the card has the card's background, so pieces pass behind
// text instead of showing through it. Positions are fixed (not random) so
// server and client render the same markup.
const COLORS = ["#B8422E", "#F2C14E", "#4673B9", "#6F9A5B", "#D16BA5"];
const PIECES = Array.from({ length: 56 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  delay: ((i * 0.29) % 3).toFixed(2),
  duration: (2.6 + (i % 5) * 0.45).toFixed(2),
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
}));

export function Confetti() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg opacity-60"
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`animate-confetti absolute block ${
            p.round ? "size-2.5 rounded-full" : "h-3.5 w-2 rounded-[1px]"
          }`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </span>
  );
}
