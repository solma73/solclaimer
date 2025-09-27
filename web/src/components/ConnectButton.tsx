'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton, useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function ConnectButton() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected) {
    // След свързване – стандартният бутон (с името на адаптера)
    return <WalletMultiButton />;
  }

  // Преди свързване – наш сив бутон с иконка на портфейл
  return (
    <button
      onClick={() => setVisible(true)}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-bg-card border border-border hover:bg-bg-raised transition text-body"
      aria-label="Connect wallet"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M21 7h-2V6a2 2 0 0 0-2-2H5C3.343 4 2 5.343 2 7v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2Zm-6-1a1 1 0 0 1 1 1v0H5a1 1 0 0 1 0-2h10ZM21 17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7h12v2h4a1 1 0 0 1 1 1v7Zm-3-5h-3a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2Z"/>
      </svg>
      <span>Connect</span>
    </button>
  );
}
