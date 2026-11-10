import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './Home';
import { WONDERS } from './registry';

function Nav() {
  const loc = useLocation();
  return (
    <div className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="logo">
          <span className="logo-orb" />
          <span>Ten&nbsp;Wonders</span>
        </Link>
        <div className="nav-links">
          {WONDERS.slice(0, 5).map((w) => (
            <Link
              key={w.slug}
              to={`/${w.slug}`}
              className={`nav-link ${loc.pathname === `/${w.slug}` ? 'active' : ''}`}
            >
              {w.short}
            </Link>
          ))}
          {WONDERS.length > 5 && (
            <Link to="/" className="nav-link" style={{ opacity: 0.6 }}>+{WONDERS.length - 5}</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ScrollTop() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return null;
}

export default function App() {
  const navigate = useNavigate();
  return (
    <>
      <ScrollTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        {WONDERS.map((w) => {
          const C = w.component;
          return <Route key={w.slug} path={`/${w.slug}`} element={<C />} />;
        })}
        <Route
          path="*"
          element={
            <div className="wrap" style={{ padding: '120px 0', textAlign: 'center' }}>
              <h1 style={{ fontSize: 56 }}>404</h1>
              <p style={{ color: 'var(--txt-2)', margin: '14px 0 26px' }}>
                That wonder doesn't exist. Yet.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/')}>Back to the list</button>
            </div>
          }
        />
      </Routes>
      <div className="footer">
        <div className="wrap spread">
          <span>Ten Wonders — built end-to-end in one session. No API keys, no servers. Just math, shipped.</span>
          <span className="mono" style={{ opacity: 0.5 }}>v1.0</span>
        </div>
      </div>
    </>
  );
}
