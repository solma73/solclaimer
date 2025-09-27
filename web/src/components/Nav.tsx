'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import React from 'react';

export default function Nav() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const links = [
    { href: '/', label: 'SolClaimer' },
    { href: '/donate', label: 'Donate' },
    { href: '/trading', label: 'Trading bot' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-card/80 backdrop-blur-md">
      <div className="container-max h-16 flex items-center justify-between">
        {/* Лого + текст вляво */}
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-wide no-underline">
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

        {/* Централни бутони – „хапче в хапче“ */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1 p-1 rounded-full border border-border bg-bg-raised/60"
        >
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
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
        </nav>

        {/* Дясно: WalletMultiButton (skin като хапче) — показваме само след mount */}
        <div className="hidden md:block">
          {mounted ? <WalletMultiButton /> : <div className="h-10 w-[140px]" />}
        </div>
      </div>
    </header>
  );
}
