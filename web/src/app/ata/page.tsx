'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

type ZeroAta = {
  ata: PublicKey;
  mint: string;
  rentLamports: number;
};

export default function AtaScannerPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ZeroAta[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalRent = useMemo(
    () => list.reduce((s, a) => s + a.rentLamports, 0),
    [list]
  );

  const fmtSOL = (lamports: number, d = 6) =>
    (lamports / LAMPORTS_PER_SOL).toFixed(d);

  const scan = useCallback(async () => {
    if (!connected || !publicKey) return;
    setLoading(true);
    setError(null);
    try {
      // Взимаме всички Token Accounts на потребителя
      const resp = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const out: ZeroAta[] = [];

      // Филтрираме абсолютно празните (amount==0) и с ненулев rent (lamports в акаунта)
      for (const { pubkey, account } of resp.value) {
        const parsed: any = account.data;
        const info = parsed?.parsed?.info;
        const amountStr = info?.tokenAmount?.amount ?? '0';
        const uiAmount = Number(info?.tokenAmount?.uiAmount ?? 0);

        if (amountStr === '0' && uiAmount === 0) {
          // Доп. проверка за lamports (rent) на акаунта
          const accInfo = await connection.getAccountInfo(pubkey);
          const lamports = accInfo?.lamports ?? 0;
          if (lamports > 0) {
            out.push({
              ata: pubkey,
              mint: info?.mint ?? 'unknown',
              rentLamports: lamports,
            });
          }
        }
      }

      // Подреждаме по най-голям rent (по-удобно визуално)
      out.sort((a, b) => b.rentLamports - a.rentLamports);
      setList(out);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, connection]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Scan Empty ATAs</h1>

      {!connected && (
        <div className="p-3 rounded bg-yellow-100 text-yellow-800">
          Свържи портфейла от началната страница, за да сканираш.
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded bg-slate-800 text-white disabled:opacity-50"
          onClick={scan}
          disabled={!connected || loading}
        >
          {loading ? 'Сканирам…' : 'Scan'}
        </button>
        {list.length > 0 && (
          <div className="px-3 py-2 rounded border">
            Намерени празни ATA: <b>{list.length}</b> • Общ rent:{" "}
            <b>{fmtSOL(totalRent)} SOL</b>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-100 text-red-800">
          Грешка: {error}
        </div>
      )}

      {list.length > 0 && (
        <div className="rounded border divide-y">
          {list.map((a) => (
            <div key={a.ata.toBase58()} className="p-3 text-sm">
              <div className="font-mono">{a.ata.toBase58()}</div>
              <div className="opacity-70">
                mint: {a.mint} • rent: {fmtSOL(a.rentLamports)} SOL
              </div>
            </div>
          ))}
        </div>
      )}

      {connected && list.length === 0 && !loading && !error && (
        <div className="opacity-70 text-sm">
          Няма намерени празни ATA (или още не си сканирал).
        </div>
      )}
    </main>
  );
}
