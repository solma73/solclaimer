'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import React from 'react';

// Load wallet button only on the client to avoid hydration issues
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const links = [
    { href: '/', label: 'SolClaimer' },
    { href: '/donate', label: 'Donate' },
    { href: '/trading', label: 'Trading' },
  ];

  const NavLinks = () => (
    <>
      {links.map((l) => {
        const active =
          pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setMenuOpen(false)} // close menu on navigation
            className={[
              'px-4 py-2 rounded-full text-sm no-underline transition',
              active
                ? 'bg-white/12 text-text'
                : 'text-text-muted hover:text-text hover:bg-white/6',
            ].join(' ')}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-card/80 backdrop-blur-md">
      <div className="container-max h-16 flex items-center justify-between">
        {/* Logo + title */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-wide no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="logo"
            width={28}
            height={28}
            className="rounded-lg border border-border"
          />
          <span>solma73</span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1 p-1 rounded-full border border-border bg-bg-raised/60"
        >
          <NavLinks />
        </nav>

        {/* Right side: Wallet button + hamburger */}
        <div className="flex items-center gap-2">
          <WalletMultiButtonDynamic />
          <button
            className="md:hidden p-2 rounded-md border border-border bg-bg-raised/50"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {/* simple hamburger icon */}
            <span className="block h-0.5 w-5 bg-current mb-1" />
            <span className="block h-0.5 w-5 bg-current mb-1" />
            <span className="block h-0.5 w-5 bg-current" />
          </button>
        </div>
      </div>

      {/* Mobile menu with animation */}
      <div
        className={[
          'md:hidden border-t border-border bg-bg-card/95 backdrop-blur-md px-4',
          'transition-all duration-250 ease-out overflow-hidden',
          menuOpen ? 'max-h-64 opacity-100 translate-y-0 py-3' : 'max-h-0 opacity-0 -translate-y-2 py-0',
        ].join(' ')}
      >
        <div className="flex flex-col gap-2">
          <NavLinks />
        </div>
      </div>
    </header>
  );
}