/** Simple house beside a tree for tiles that do not yet have an uploaded image. */
export function ApplicationPlaceholder() {
  return (
    <svg className="application-tile-placeholder" viewBox="0 0 120 80" role="img" aria-hidden="true">
      <rect width="120" height="80" fill="currentColor" className="application-tile-placeholder-canvas" />
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="application-tile-placeholder-drawing">
        <path d="M28 54 V36 L42 24 L56 36 V54 Z" />
        <path d="M38 54 V44 H46 V54" />
        <path d="M78 54 V42" />
        <path d="M68 42 C68 30 78 24 78 24 C78 24 88 30 88 42 Z" />
        <path d="M22 54 H98" />
      </g>
    </svg>
  );
}
