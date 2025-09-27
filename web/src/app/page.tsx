'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID, createCloseAccountInstruction } from '@solana/spl-token';
import { fetchTokenMeta, TokenMeta } from '@/lib/tokenMeta';

type ZeroAta = {
  ata: PublicKey;
  mint: string;
  rentLamports: number;
  meta?: TokenMeta;
};

const MAX_IX_PER_TX = 20; // безопасен лимит
const fmtSOL = (lamports: number, d = 6) => (lamports / LAMPORTS_PER_SOL).toFixed(d);
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC!;

function safeErr(e: any) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export default function HomePage() {
  const { publicKey, connected, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();

  const [scanning, setScanning] = useState(false);
  const [atas, setAtas] = useState<ZeroAta[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');
  const [estFeeLamports, setEstFeeLamports] = useState<number>(5_000);

  const selectedList = useMemo(
    () => atas.filter((a) => selected[a.ata.toBase58()]),
    [atas, selected]
  );

  const totals = useMemo(() => {
    const n = selectedList.length;
    const totalRent = selectedList.reduce((s, a) => s + a.rentLamports, 0);
    const fee = estFeeLamports;
    const netToUser = totalRent - fee;
    return { n, totalRent, fee, netToUser, perAtaNet: n ? netToUser / n : 0 };
  }, [selectedList, estFeeLamports]);

  const scan = useCallback(async () => {
    if (!connected || !publicKey) return;
    setScanning(true);
    setAtas([]); setSelected({}); setLog('');
    try {
      const resp = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
      const out: ZeroAta[] = [];
      for (const { pubkey, account } of resp.value) {
        const parsed: any = account.data;
        const info = parsed?.parsed?.info;
        const amountStr = info?.tokenAmount?.amount ?? '0';
        const uiAmount = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (amountStr === '0' && uiAmount === 0) {
          const accInfo = await connection.getAccountInfo(pubkey);
          const lamports = accInfo?.lamports ?? 0;
          if (lamports > 0) out.push({ ata: pubkey, mint: info?.mint ?? 'unknown', rentLamports: lamports });
        }
      }
      out.sort((a, b) => b.rentLamports - a.rentLamports);
      setAtas(out);
      const sel: Record<string, boolean> = {};
      for (const a of out) sel[a.ata.toBase58()] = true;
      setSelected(sel);
      setLog(`Found empty ATAs: ${out.length}`);

      // зареждаме metadata асинхронно
      const CONC = 6; let idx = 0;
      async function worker() {
        while (idx < out.length) {
          const i = idx++; const m = out[i];
          fetchTokenMeta(RPC, m.mint).then((meta) => {
            setAtas((prev) => {
              const copy = [...prev];
              const j = copy.findIndex((x) => x.ata.equals(m.ata));
              if (j >= 0) copy[j] = { ...copy[j], meta };
              return copy;
            });
          }).catch(()=>{});
        }
      }
      await Promise.all(Array.from({ length: CONC }, worker));
    } catch (e: any) {
      setLog(`Scan error: ${safeErr(e)}`);
    } finally {
      setScanning(false);
    }
  }, [connected, publicKey, connection]);

  const toggleOne = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const toggleAll = (value: boolean) => {
    const m: Record<string, boolean> = {};
    for (const a of atas) m[a.ata.toBase58()] = value;
    setSelected(m);
  };

  async function buildCloseBatches(owner: PublicKey, picks: ZeroAta[]) {
    const closeIxs = picks.map((a) => createCloseAccountInstruction(a.ata, owner, owner));
    const txs: VersionedTransaction[] = [];
    let feeSum = 0;

    for (let i = 0; i < closeIxs.length; i += MAX_IX_PER_TX) {
      const chunk = closeIxs.slice(i, i + MAX_IX_PER_TX);
      const latest = await connection.getLatestBlockhash();
      const msg = new TransactionMessage({
        payerKey: owner,
        recentBlockhash: latest.blockhash,
        instructions: chunk,
      }).compileToV0Message();

      try {
        const feeResp = await connection.getFeeForMessage(msg, 'confirmed');
        feeSum += Number(feeResp.value ?? 5000);
      } catch {
        feeSum += 5000;
      }

      txs.push(new VersionedTransaction(msg));
    }

    setEstFeeLamports(feeSum);
    return txs;
  }

  const execute = useCallback(async () => {
    if (!connected || !publicKey || !wallet) return;
    if (selectedList.length === 0) { setLog('No selected ATAs.'); return; }

    setBusy(true); setLog('Building close batches…');
    try {
      const txs = await buildCloseBatches(publicKey, selectedList);
      const sigs: string[] = [];

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        try {
          const sig = await sendTransaction(tx, connection, { skipPreflight: false });
          const latest = await connection.getLatestBlockhash();
          await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
          sigs.push(sig);
        } catch (e: any) {
          setLog(prev => prev + `\n⛔ Send error on batch ${i + 1}: ${safeErr(e)}`);
        }
      }

      setLog(prev =>
        prev +
        `\nDone. Closed ${sigs.length}/${txs.length} batches.\n` +
        (sigs.length ? sigs.map((s) => `https://explorer.solana.com/tx/${s}`).join('\n') : '')
      );
    } catch (e: any) {
      setLog(prev => prev + `\nError: ${safeErr(e)}`);
    } finally {
      setBusy(false);
    }
  }, [connected, publicKey, wallet, selectedList, connection, sendTransaction]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6">
      <h1 className="text-h1 mt-2">Solclaimer</h1>

      {!connected && (
        <div className="text-sm text-text-muted text-center">
          Please connect your wallet (top-right) to reclaim rent from empty token accounts.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={scan} disabled={!connected || scanning} className="btn-pill">
          {connected ? (scanning ? 'Scanning…' : 'Scan') : 'Connect wallet first'}
        </button>
        {atas.length > 0 && (
          <>
            <button className="btn-pill" onClick={() => toggleAll(true)}>Select all</button>
            <button className="btn-pill" onClick={() => toggleAll(false)}>Unselect all</button>
          </>
        )}
      </div>

      {connected && (
        <section className="w-full max-w-5xl space-y-4">
          <div className="text-sm text-text-muted">
            {atas.length > 0 ? (
              <>Found empty ATAs: <b className="text-text">{atas.length}</b> • Selected: <b className="text-text">{totals.n}</b> • Total rent (selected): <b className="text-text">{fmtSOL(totals.totalRent)} SOL</b></>
            ) : scanning ? (
              <>Scanning for empty ATAs…</>
            ) : (
              <>Click <b>Scan</b> to detect empty token accounts.</>
            )}
          </div>

          {atas.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {atas.map((a) => {
                const k = a.ata.toBase58();
                const displayName =
                  a.meta?.name ||
                  (a.meta?.symbol ? `${a.meta.symbol}` : `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`);
                const badgeText =
                  (a.meta?.symbol?.slice(0, 2) ||
                    a.meta?.name?.slice(0, 2) ||
                    a.mint.slice(0, 2)).toUpperCase();
                return (
                  <label key={k} className="card-base flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[k]}
                        onChange={() => toggleOne(k)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      {a.meta?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.meta.image} alt="" className="w-10 h-10 rounded-xl object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-bg-raised border border-border grid place-items-center text-[11px] font-semibold">
                          {badgeText}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-small text-text-muted">
                          rent: {fmtSOL(a.rentLamports)} SOL
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-text-muted font-mono truncate">{k}</div>
                  </label>
                );
              })}
            </div>
          )}

          {totals.n > 0 && (
            <div className="card-base p-4 text-small space-y-2">
              <div className="text-h2">Summary</div>
              <div>Estimated fee (total): <b>~{fmtSOL(totals.fee)} SOL</b></div>
              <div>Net to you: <b>{fmtSOL(totals.netToUser)} SOL</b> (≈ {fmtSOL(totals.perAtaNet)} SOL/ATA)</div>

              <button onClick={execute} disabled={busy} className="btn-pill-primary mt-1">
                {busy ? 'Signing…' : `Close ${totals.n} ATA`}
              </button>
            </div>
          )}

          {log && <pre className="card-base p-3 whitespace-pre-wrap text-small">{log}</pre>}
        </section>
      )}
    </main>
  );
}
