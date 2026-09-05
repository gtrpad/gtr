export const Icon = {
  download: (
    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3v11m0 0l-4-4m4 4l4-4M4 17v3h16v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="18" cy="5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="19" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" width="16" height="16"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  caret: <svg viewBox="0 0 10 5" width="10" height="5" className="caret"><path d="M0 0h10L5 5z" fill="currentColor" /></svg>,
  arrow: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14m-6-6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

export const Help = () => (
  <span className="help" aria-label="help">
    ?
  </span>
);
