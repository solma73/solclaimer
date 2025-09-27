import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/solana/Providers';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Solclaimer',
  description: 'Close empty ATAs safely (optional donation)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className="dark">
      <body>
        <Providers>
          <Nav />
          <div className="container-max py-6">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
