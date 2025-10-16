'use client';

import Image from 'next/image';
import Link from 'next/link';

type Partner = {
  id: string;
  name: string;
  href: string;       // your referral link
  logoSrc: string;    // /partners/*.svg
  tagline: string;    // short English tagline
  cta?: string;
  note?: string;
};

const PARTNERS: Partner[] = [
  {
    id: 'binance',
    name: 'Binance',
    href: 'https://accounts.binance.com/register?ref=36328344',
    logoSrc: '/partners/binance.svg',
    tagline: 'Low fees, deep liquidity, spot & derivatives.',
    cta: 'Sign up',
  },
  {
    id: 'mexc',
    name: 'MEXC',
    href: 'https://promote.mexc.com/r/M7dWENIX',
    logoSrc: '/partners/mexc.svg',
    tagline: 'Frequent listings, promos, and futures.',
    cta: 'Get bonus',
  },
  {
    id: 'gmgn',
    name: 'gmgn.ai',
    href: 'https://gmgn.ai/r/6bAYEdfw',
    logoSrc: '/partners/gmgn.svg',
    tagline: 'DeFi terminal for real-time token tracking & trading.',
    cta: 'Open',
    note: 'Tool • not a centralized exchange',
  },
];

function PartnerCard({ p }: { p: Partner }) {
  return (
    <div className="card-base p-5 rounded-2xl border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-xl bg-bg-raised p-3 border border-border/40">
          <Image
            src={p.logoSrc}
            alt={`${p.name} logo`}
            width={40}
            height={40}
            loading="lazy"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-h4">{p.name}</h3>
          <p className="text-body text-text-muted">{p.tagline}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={p.href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-border/60 hover:border-border bg-bg-raised text-sm"
        >
          {p.cta ?? 'Open'}
          <span aria-hidden>↗</span>
        </Link>
        <span className="text-xs text-text-muted">
          ref • affiliate{p.note ? ` • ${p.note}` : ''}
        </span>
      </div>
    </div>
  );
}

export default function TradingPage() {
  return (
    <main className="container-max py-10">
      <header className="mb-8 text-center">
        <h1 className="text-h1 mb-2">Trading bot</h1>
        <p className="text-body text-text-muted">
          The bot UI is coming soon. Meanwhile, here are our partners:
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PARTNERS.map((p) => (
          <PartnerCard key={p.id} p={p} />
        ))}
      </section>

      <footer className="mt-8 text-center text-xs text-text-muted">
        ⚠️ Not financial advice. We may earn affiliate commissions if you register via these links.
      </footer>
    </main>
  );
}
