// App kit — shared icon helper (compact lucide-style)
function MIcon({ name, size = 22 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:    <React.Fragment><path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></React.Fragment>,
    chat:    <React.Fragment><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></React.Fragment>,
    doc:     <React.Fragment><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></React.Fragment>,
    cog:     <React.Fragment><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></React.Fragment>,
    target:  <React.Fragment><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></React.Fragment>,
    plus:    <React.Fragment><path d="M12 5v14M5 12h14"/></React.Fragment>,
    chevron: <React.Fragment><path d="m9 18 6-6-6-6"/></React.Fragment>,
    chevdown:<React.Fragment><path d="m6 9 6 6 6-6"/></React.Fragment>,
    file:    <React.Fragment><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></React.Fragment>,
    send:    <React.Fragment><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></React.Fragment>,
    bell:    <React.Fragment><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></React.Fragment>,
    back:    <React.Fragment><path d="m15 18-6-6 6-6"/></React.Fragment>,
    close:   <React.Fragment><path d="M18 6 6 18M6 6l12 12"/></React.Fragment>,
    paw:     null, // handled below
    user:    <React.Fragment><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></React.Fragment>,
    sparkle: <React.Fragment><path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z" fill="currentColor" stroke="none"/></React.Fragment>,
    download:<React.Fragment><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></React.Fragment>,
    check:   <React.Fragment><path d="M20 6 9 17l-5-5"/></React.Fragment>,
  };
  return <svg {...props}>{paths[name] || paths.doc}</svg>;
}

window.MIcon = MIcon;
