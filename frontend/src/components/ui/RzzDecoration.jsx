/**
 * RZZ brand mark — the three-circle logo — used as animated hero decoration.
 * Position and color are controlled via className (use text-white + opacity-*).
 */
export default function RzzDecoration({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ animation: 'rzzFloat 22s ease-in-out infinite' }}
    >
      <svg
        viewBox="0 0 108.9 84.4"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        width="100%"
        height="100%"
      >
        <path d="M87.1,21.8c0-12-9.8-21.8-21.8-21.8s-21.8,9.7-21.8,21.7h0c0-12-9.8-21.7-21.8-21.7S0,9.8,0,21.8s7.1,18.8,16.6,21.1c-1.5-4.2-1.5-9,.5-13.5,4.1-9,14.8-13,23.9-8.8.9.4,1.7.9,2.5,1.4h0c3.3,2.2,5.7,5.4,7,8.9h0c1.6,4.5,4.9,8.4,9.6,10.5,3.9,1.8,8.2,2,12,1,8.7-2.9,14.9-11,14.9-20.7M65.3,62.6c0-12-9.8-21.8-21.8-21.8s-21.8,9.8-21.8,21.8,9.8,21.8,21.8,21.8,21.8-9.8,21.8-21.8M108.9,62.6c0-12-9.8-21.8-21.8-21.8s-21.8,9.8-21.8,21.8,9.8,21.8,21.8,21.8,21.8-9.8,21.8-21.8" />
      </svg>
    </div>
  );
}
