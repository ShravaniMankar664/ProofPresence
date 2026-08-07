import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../store';
import { GlobeIcon, LogoMark, ScanIcon, ShieldIcon, UserIcon, WalletIcon } from './icons';
import { Toasts } from './Toasts';

function shortAddress(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

export function Nav() {
  const { wallet, connected } = useApp();

  const links = [
    { to: '/', label: 'Home', icon: GlobeIcon },
    { to: '/organizer', label: 'Organizer', icon: UserIcon },
    { to: '/attend', label: 'Attendee', icon: ScanIcon },
    { to: '/verify', label: 'Verify', icon: ShieldIcon },
  ];

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="logo" aria-label="ProofPresence home">
            <span className="logo-mark">
              <LogoMark size={18} />
            </span>
            ProofPresence
          </Link>

          <nav className="nav-links">
            {links.slice(0, 4).map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link keep ${isActive ? 'active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-wallet">
            {connected && wallet ? (
              <div className="wallet-chip" title={wallet.walletAddress}>
                <span className="wallet-dot" />
                {shortAddress(wallet.walletAddress)}
              </div>
            ) : (
              <Link to="/wallet" className="btn btn-primary btn-sm">
                <WalletIcon size={15} /> Connect
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <div className="bottom-nav-inner">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon size={22} />
                <span>{l.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMark size={16} />
          <b>ProofPresence</b>
        </div>
        <span>
          Built for the <b>Midnight Network</b> — zero-knowledge, on-chain attendance.
        </span>
        <span>© {new Date().getFullYear()} ProofPresence</span>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="aurora" />
      <div className="grid-overlay" />
      <Nav />
      <Toasts />
      <main>{children}</main>
      <Footer />
    </>
  );
}
