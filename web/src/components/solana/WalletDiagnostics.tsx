'use client';
import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function WalletDiagnostics() {
  const { wallets, wallet, connected, connecting, disconnecting, publicKey, select, connect, disconnect } = useWallet();

  return (
    <div className="text-xs p-3 rounded border max-w-xl w-full">
      <div className="font-semibold mb-1">Wallet Diagnostics</div>
      <div>connected: <b>{String(connected)}</b></div>
      <div>connecting: <b>{String(connecting)}</b> | disconnecting: <b>{String(disconnecting)}</b></div>
      <div>selected wallet: <b>{wallet?.adapter.name ?? '-'}</b></div>
      <div>publicKey: <b>{publicKey?.toBase58() ?? '-'}</b></div>
      <div className="mt-2">
        <div className="font-semibold">Detected wallets ({wallets.length}):</div>
        <ul className="list-disc ml-5">
          {wallets.map(w => (
            <li key={w.adapter.name}>
              {w.adapter.name} — readyState: <b>{w.readyState}</b>
              <button
                className="ml-2 px-2 py-0.5 border rounded"
                onClick={() => select(w.adapter.name)}
              >
                select
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 flex gap-2">
        <button className="px-3 py-1 border rounded" onClick={() => wallet?.adapter.connect().catch(()=>{})}>
          adapter.connect()
        </button>
        <button className="px-3 py-1 border rounded" onClick={() => connect().catch(()=>{})}>
          useWallet.connect()
        </button>
        <button className="px-3 py-1 border rounded" onClick={() => disconnect().catch(()=>{})}>
          disconnect()
        </button>
      </div>

      <details className="mt-2">
        <summary>window.solana flags</summary>
        <pre className="overflow-auto text-[10px]">
{`isPhantom: ${typeof window !== 'undefined' && (window as any).solana?.isPhantom}
isSolflare: ${typeof window !== 'undefined' && (window as any).solflare?.isSolflare}
solana?.isConnected: ${typeof window !== 'undefined' && (window as any).solana?.isConnected}
`}
        </pre>
      </details>
    </div>
  );
}
