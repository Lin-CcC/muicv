// Mui Studio marketing kit — shared icon helpers + small bits.
// Drawn by hand to keep marketing handcrafted feel (mirroring muicv).

const ICON_BASE = 'h-5 w-5';

function PawIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="6"  cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="10.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="13.5" cy="6" rx="1.8" ry="2.4" fill="currentColor" />
      <ellipse cx="18" cy="9" rx="1.8" ry="2.4" fill="currentColor" />
      <path d="M12 11c-3 0-5 2.5-5 5 0 1.8 1.5 3 3.2 3 .8 0 1.2-.4 1.8-.4s1 .4 1.8.4c1.7 0 3.2-1.2 3.2-3 0-2.5-2-5-5-5z" fill="currentColor"/>
    </svg>
  );
}

function Sparkle({ className = 'h-3.5 w-3.5 wiggle' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2 L13.6 9.4 L21 12 L13.6 14.6 L12 22 L10.4 14.6 L3 12 L10.4 9.4 Z" fill="currentColor" />
    </svg>
  );
}

function ArrowUpRight({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 17L17 7M17 7H8M17 7v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Highlight({ children }) {
  return <span className="highlight">{children}</span>;
}

function DocIcon({ className = ICON_BASE }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function TargetIcon({ className = ICON_BASE }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
function ChatIcon({ className = ICON_BASE }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 5h16v11H8l-4 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function CompassIcon({ className = ICON_BASE }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="m15 9-2 5-5 2 2-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function CorgiMascot({ size = 36 }) {
  return <img src="../../assets/mui-mascot.png" width={size} height={size} alt="" style={{ display: 'block' }} />;
}

Object.assign(window, {
  PawIcon, Sparkle, ArrowUpRight, Highlight, CorgiMascot,
  DocIcon, TargetIcon, ChatIcon, CompassIcon,
});
