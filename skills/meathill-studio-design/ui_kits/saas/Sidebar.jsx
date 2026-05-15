// SaaS kit — Sidebar navigation

function Sidebar({ section, onChange }) {
  const groups = [
    {
      label: '工作区',
      items: [
        { id: 'overview',  label: '概览',      icon: 'home',     count: null },
        { id: 'materials', label: '职业素材',  icon: 'doc',      count: 28 },
        { id: 'versions',  label: '简历版本',  icon: 'file',     count: 7 },
        { id: 'jobs',      label: '岗位',      icon: 'target',   count: 12 },
      ],
    },
    {
      label: '系统',
      items: [
        { id: 'sync',     label: '同步',  icon: 'refresh', count: null },
        { id: 'billing',  label: '订阅',  icon: 'card',    count: null },
        { id: 'settings', label: '设置',  icon: 'cog',     count: null },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <img src="../../assets/mui-mascot.png" width="30" height="30" alt="" />
        <span className="name">Meathill Studio</span>
      </div>
      <div className="sb-search">
        <span className="ic">{Icon('search', 14)}</span>
        <input placeholder="搜索素材、岗位、设置…" />
        <span className="kbd">⌘K</span>
      </div>
      {groups.map((g) => (
        <React.Fragment key={g.label}>
          <p className="sb-group">— {g.label}</p>
          <nav className="sb-nav">
            {g.items.map((it) => (
              <button key={it.id}
                className={`sb-item ${section === it.id ? 'active' : ''}`}
                onClick={() => onChange(it.id)}>
                {Icon(it.icon, 14)}
                {it.label}
                {it.count != null && <span className="count">{it.count}</span>}
              </button>
            ))}
          </nav>
        </React.Fragment>
      ))}
      <div className="sb-footer">
        <span className="sb-avatar">M</span>
        <span className="who">
          <span className="em">Meathill</span><br/>
          <span className="sm">Pro · 7,840 tokens</span>
        </span>
      </div>
    </aside>
  );
}

// Inline lucide-style icon helper (returns <svg>)
function Icon(name, size = 16) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:    <React.Fragment><path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></React.Fragment>,
    doc:     <React.Fragment><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></React.Fragment>,
    file:    <React.Fragment><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></React.Fragment>,
    target:  <React.Fragment><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></React.Fragment>,
    refresh: <React.Fragment><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 4v5h-5M3 20v-5h5"/></React.Fragment>,
    card:    <React.Fragment><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></React.Fragment>,
    cog:     <React.Fragment><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></React.Fragment>,
    search:  <React.Fragment><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></React.Fragment>,
    plus:    <React.Fragment><path d="M12 5v14M5 12h14"/></React.Fragment>,
    bell:    <React.Fragment><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></React.Fragment>,
    download:<React.Fragment><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></React.Fragment>,
    check:   <React.Fragment><path d="M20 6 9 17l-5-5"/></React.Fragment>,
    upload:  <React.Fragment><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></React.Fragment>,
    chat:    <React.Fragment><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></React.Fragment>,
    chevron: <React.Fragment><path d="m9 18 6-6-6-6"/></React.Fragment>,
  };
  return <svg {...props}>{paths[name] || paths.doc}</svg>;
}

Object.assign(window, { Sidebar, Icon });
