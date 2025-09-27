'use client';
import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function WalletDebug() {
  const { wallet, select, connect, disconnect, connecting } = useWallet();
  const [log, setLog] = useState<string>('');

  useEffect(() => {
    if (!wallet) return;
    const onError = (e: any) => {
      setLog(prev => prev + `\n[adapter.error] ${e?.message || e}`);
    };
    // @ts-ignore
    wallet.adapter.on('error', onError);
    return () => {
      // @ts-ignore
      wallet.adapter.off?.('error', onError);
    };
  }, [wallet]);

  const nativeConnect = async () => {
    try {
      const sol: any = (window as any).solana;
      if (!sol?.isPhantom) {
        setLog(prev => prev + '\n[native] Phantom не е наличен (window.solana?.isPhantom !== true)');
        return;
      }
      const res = await sol.connect({ onlyIfTrusted: false });
      setLog(prev => prev + `\n[native] connected pubkey=${res?.publicKey?.toBase58?.()}`);
    } catch (e: any) {
      setLog(prev => prev + `\n[native.error] ${e?.message || e}`);
    }
  };

  const nativeDisconnect = async () => {
    try {
      const sol: any = (window as any).solana;
      await sol?.disconnect?.();
      setLog(prev => prev + `\n[native] disconnected`);
    } catch (e: any) {
      setLog(prev => prev + `\n[native.error] ${e?.message || e}`);
    }
  };

  return (
    <div className="text-xs p-3 rounded border max-w-xl w-full">
      <div className="font-semibold mb-1">Wallet Debug</div>
      <div className="flex gap-2 mb-2">
        <button className="px-2 py-1 border rounded" onClick={() => select('Phantom')}>select Phantom</button>
        <button className="px-2 py-1 border rounded" onClick={() => connect() } disabled={connecting}>adapter.connect()</button>
        <button className="px-2 py-1 border rounded" onClick={nativeConnect}>window.solana.connect()</button>
        <button className="px-2 py-1 border rounded" onClick={() => disconnect()}>adapter.disconnect()</button>
        <button className="px-2 py-1 border rounded" onClick={nativeDisconnect}>native disconnect</button>
      </div>
      <pre className="whitespace-pre-wrap max-h-60 overflow-auto bg-black/5 p-2">{log || '— без логове още —'}</pre>
    </div>
  );
}
