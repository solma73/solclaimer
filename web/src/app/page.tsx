'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { fetchTokenMeta, TokenMeta } from '@/lib/tokenMeta';

/* ───────────────────────────── Types & consts ───────────────────────────── */

type ZeroAta = {
  ata: PublicKey;
  mint: string;
  programId?: PublicKey; // remember owner program (TOKEN vs TOKEN-2022)
  rentLamports: number;
  meta?: TokenMeta;
};

type AtaStatsEvent = {
  ts: string; // ISO string
  reclaimedLamports: number; // NET
  txSigs: string[];
  closedCount: number;
};

type AtaStats = {
  totalClosed: number;
  totalReclaimedLamports: number; // NET total
  events: AtaStatsEvent[];
};

type BuiltBatch = {
  tx: VersionedTransaction;
  ixs: TransactionInstruction[];
  items: ZeroAta[];
};

const MAX_IX_PER_TX = 20; // safe limit per tx
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC!;

/* ───────────────────────────── Helpers ───────────────────────────── */

const fmtSOL = (lamports: number, d = 6) =>
  (lamports / LAMPORTS_PER_SOL).toFixed(d);

function safeErr(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e && 'message' in e) {
    try {
      // @ts-expect-error - best-effort
      return String((e as any).message ?? 'Error');
    } catch {
      return 'Error';
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/* ───────────────────── Local Stats API (file-backed) ───────────────────── */

async function fetchLocalStatsAPI(pubkey: string): Promise<AtaStats> {
  const r = await fetch(`/api/local/stats?pubkey=${encodeURIComponent(pubkey)}`, {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Local stats GET failed (${r.status})`);
  return r.json();
}

async function saveLocalStatsAPI(pubkey: string, data: AtaStats) {
  const r = await fetch(`/api/local/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey, data }),
  });
  if (!r.ok) throw new Error(`Local stats POST failed (${r.status})`);
}

/* ───────────────────────────── Component ───────────────────────────── */

export default function HomePage() {
  const { publicKey, connected, sendTransaction, wallet } = useWallet();
  const { connection } = useConnection();

  const getBalanceC = useCallback(
    (pk: PublicKey) => connection.getBalance(pk, 'confirmed'),
    [connection]
  );

  const [scanning, setScanning] = useState(false);
  const [atas, setAtas] = useState<ZeroAta[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');
  const [estFeeLamports, setEstFeeLamports] = useState<number>(0);

  // Lifetime stats (per wallet), last recovery amount, success banner, last txs
  const [lifetime, setLifetime] = useState<AtaStats | null>(null);
  const [lastRecoveredLamports, setLastRecoveredLamports] = useState<number>(0);
  const [successBanner, setSuccessBanner] = useState<string>('');
  const [lastTxSigs, setLastTxSigs] = useState<string[]>([]);

  // derived
  const selectedList = useMemo(
    () => atas.filter((a) => selected[a.ata.toBase58()]),
    [atas, selected]
  );

  const totals = useMemo(() => {
    const n = selectedList.length;
    const totalRent = selectedList.reduce((s, a) => s + a.rentLamports, 0);
    const fee = estFeeLamports;
    const netToUser = Math.max(0, totalRent - fee);
    return { n, totalRent, fee, netToUser, perAtaNet: n ? netToUser / n : 0 };
  }, [selectedList, estFeeLamports]);

  // Load stats from local file API when wallet connects/changes
  useEffect(() => {
    (async () => {
      if (!publicKey) {
        setLifetime(null);
        return;
      }
      try {
        const stats = await fetchLocalStatsAPI(publicKey.toBase58());
        const safe: AtaStats = {
          totalClosed: Number(stats?.totalClosed ?? 0),
          totalReclaimedLamports: Number(stats?.totalReclaimedLamports ?? 0),
          events: Array.isArray(stats?.events) ? stats.events : [],
        };
        setLifetime(safe);
      } catch {
        setLifetime({ totalClosed: 0, totalReclaimedLamports: 0, events: [] });
      }
    })();
  }, [publicKey]);

  // Scan helper that merges Token Program & Token-2022
  const scanOwnerATAs = useCallback(
    async (owner: PublicKey) => {
      const [a, b] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(owner, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection
          .getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_2022_PROGRAM_ID,
          })
          .catch(() => ({ value: [] as any[] })), // if node doesn't support 2022 on parsed, ignore
      ]);
      return [...a.value, ...b.value];
    },
    [connection]
  );

  // Scan action
  const scan = useCallback(async () => {
    if (!connected || !publicKey) return;
    setScanning(true);
    setAtas([]);
    setSelected({});
    setLog('');
    setSuccessBanner('');
    setLastRecoveredLamports(0);
    setLastTxSigs([]);

    try {
      const resp = await scanOwnerATAs(publicKey);
      const out: ZeroAta[] = [];

      // Build list of zero-balance ATAs and their rent
      for (const { pubkey, account } of resp) {
        const parsed: any = account.data;
        const info = parsed?.parsed?.info;
        const amountStr = info?.tokenAmount?.amount ?? '0';
        const uiAmount = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (amountStr === '0' && uiAmount === 0) {
          const accInfo = await connection.getAccountInfo(pubkey);
          const lamports = accInfo?.lamports ?? 0;
          if (lamports > 0) {
            out.push({
              ata: pubkey,
              mint: info?.mint ?? 'unknown',
              // remember which token program owns this ATA
              // @ts-expect-error: web3 type is PublicKey
              programId: account.owner,
              rentLamports: lamports,
            });
          }
        }
      }

      out.sort((a, b) => b.rentLamports - a.rentLamports);
      setAtas(out);

      // default → select all found
      const sel: Record<string, boolean> = {};
      for (const a of out) sel[a.ata.toBase58()] = true;
      setSelected(sel);

      setLog(`Found empty token accounts: ${out.length}`);
    } catch (e) {
      setLog(`Scan error: ${safeErr(e)}`);
    } finally {
      setScanning(false);
    }
  }, [connected, publicKey, connection, scanOwnerATAs]);

  // Fee estimator (dry-run build of the same TXs and getFeeForMessage)
  const estimateFeeLamports = useCallback(
    async (owner: PublicKey, picks: ZeroAta[]) => {
      try {
        const closeIxs = picks.map((a) => {
          const programId =
            a.programId && a.programId.equals?.(TOKEN_2022_PROGRAM_ID)
              ? TOKEN_2022_PROGRAM_ID
              : TOKEN_PROGRAM_ID;
          return createCloseAccountInstruction(a.ata, owner, owner, [], programId);
        });

        let feeSum = 0;
        for (let i = 0; i < closeIxs.length; i += MAX_IX_PER_TX) {
          const chunkIxs = closeIxs.slice(i, i + MAX_IX_PER_TX);
          const latest = await connection.getLatestBlockhash();
          const msg = new TransactionMessage({
            payerKey: owner,
            recentBlockhash: latest.blockhash,
            instructions: chunkIxs,
          }).compileToV0Message();

          const feeResp = await connection.getFeeForMessage(msg, 'finalized');
          feeSum += feeResp?.value ?? Math.round(0.00008 * LAMPORTS_PER_SOL); // fallback
        }

        setEstFeeLamports(feeSum);
      } catch {
        const txCount = Math.ceil(picks.length / MAX_IX_PER_TX) || 1;
        setEstFeeLamports(txCount * Math.round(0.00008 * LAMPORTS_PER_SOL));
      }
    },
    [connection]
  );

  // Реалното build-ване на партидите за изпращане
  const buildCloseBatches = useCallback(
    async (owner: PublicKey, picks: ZeroAta[]) => {
      const closeIxs = picks.map((a) => {
        const programId =
          a.programId && a.programId.equals?.(TOKEN_2022_PROGRAM_ID)
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID;
        return createCloseAccountInstruction(a.ata, owner, owner, [], programId);
      });

      const batches: BuiltBatch[] = [];
      for (let i = 0; i < closeIxs.length; i += MAX_IX_PER_TX) {
        const chunkIxs = closeIxs.slice(i, i + MAX_IX_PER_TX);
        const latest = await connection.getLatestBlockhash();
        const msg = new TransactionMessage({
          payerKey: owner,
          recentBlockhash: latest.blockhash,
          instructions: chunkIxs,
        }).compileToV0Message();

        batches.push({
          tx: new VersionedTransaction(msg),
          ixs: chunkIxs,
          items: picks.slice(i, i + MAX_IX_PER_TX),
        });
      }
      return batches;
    },
    [connection]
  );

  // Auto-scan immediately once wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const t = setTimeout(() => {
        scan();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [connected, publicKey, scan]);

  // Auto-update the fee estimate whenever the selection changes
  useEffect(() => {
    if (connected && publicKey) {
      if (selectedList.length === 0) {
        setEstFeeLamports(0);
      } else {
        estimateFeeLamports(publicKey, selectedList);
      }
    } else {
      setEstFeeLamports(0);
    }
  }, [connected, publicKey, selectedList, estimateFeeLamports]);

  const toggleOne = (k: string) =>
    setSelected((s) => ({ ...s, [k]: !s[k] }));
  const toggleAll = (value: boolean) => {
    const m: Record<string, boolean> = {};
    for (const a of atas) m[a.ata.toBase58()] = value;
    setSelected(m);
  };

  // Execute: send batches, compute NET via balance delta, store stats locally, show banner
  const execute = useCallback(async () => {
    if (!connected || !publicKey || !wallet) return;
    if (selectedList.length === 0) {
      setLog('No selected token accounts.');
      return;
    }

    setBusy(true);
    setLog('Building close batches…');
    setSuccessBanner('');
    setLastRecoveredLamports(0);
    setLastTxSigs([]);

    try {
      // snapshot
      const picked = [...selectedList];

      // 1) баланс ПРЕДИ
      const balBefore = await getBalanceC(publicKey);

      // 2) build & send
      const batches = await buildCloseBatches(publicKey, picked);
      const sigs: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        try {
          const sig = await sendTransaction(batches[i].tx, connection, {
            skipPreflight: false,
          });
          const latest = await connection.getLatestBlockhash();
          await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
          sigs.push(sig);
        } catch (e) {
          setLog((prev) => prev + `\n⛔ Send error on batch ${i + 1}: ${safeErr(e)}`);
        }
      }

      // линкове
      setLastTxSigs(sigs);
      setLog((prev) =>
        prev +
        `\nTransactions:\n` +
        (sigs.length ? sigs.map((s) => `https://solscan.io/tx/${s}`).join('\n') : '—')
      );

      // 3) баланс СЛЕД (малък retry срещу RPC race)
      let balAfter = await getBalanceC(publicKey);
      for (let i = 0; i < 3 && balAfter === balBefore; i++) {
        await new Promise((r) => setTimeout(r, 400));
        balAfter = await getBalanceC(publicKey);
      }

      // 4) NET (реално полученото след такси)
      const netLamports = Math.max(0, balAfter - balBefore);

      // 5) GROSS (по старата верификация — само за инфо)
      let grossLamports = 0;
      try {
        const infos = await connection.getMultipleAccountsInfo(selectedList.map((p) => p.ata));
        infos.forEach((info, idx) => {
          if (info === null) grossLamports += selectedList[idx].rentLamports;
        });
      } catch {}

      const feeEstimate = grossLamports > 0 ? Math.max(0, grossLamports - netLamports) : undefined;

      // 6) запис в локалната статистика (ползваме NET)
      const pk = publicKey.toBase58();
      const current: AtaStats = {
        totalClosed: (lifetime?.totalClosed ?? 0) + selectedList.length,
        totalReclaimedLamports: (lifetime?.totalReclaimedLamports ?? 0) + netLamports,
        events: [
          ...(lifetime?.events ?? []),
          {
            ts: new Date().toISOString(),
            reclaimedLamports: netLamports, // NET
            txSigs: sigs,
            closedCount: selectedList.length,
          },
        ],
      };

      await saveLocalStatsAPI(pk, current);
      setLifetime(current);
      setLastRecoveredLamports(netLamports);

      setSuccessBanner(
        'Success! Your empty token accounts were closed. If you like the project, visit the Donate or Trading page to see how you can support us.'
      );

      // 7) лог
      setLog((prev) =>
        prev +
        `\nBalance before: ${fmtSOL(balBefore)} SOL` +
        `\nBalance after:  ${fmtSOL(balAfter)} SOL` +
        (grossLamports ? `\nRecovered (gross): ${fmtSOL(grossLamports)} SOL` : '') +
        (feeEstimate !== undefined ? `\nEstimated fees: ${fmtSOL(feeEstimate)} SOL` : '') +
        `\nRecovered NET: ${fmtSOL(netLamports)} SOL` +
        `\nLifetime recovered: ${fmtSOL(current.totalReclaimedLamports)} SOL across ${current.totalClosed} ATAs.`
      );

      // 8) refresh
      await scan();
    } catch (e) {
      setLog((prev) => prev + `\nError: ${safeErr(e)}`);
    } finally {
      setBusy(false);
    }
  }, [
    connected,
    publicKey,
    wallet,
    selectedList,
    connection,
    sendTransaction,
    buildCloseBatches,
    scan,
    lifetime,
    getBalanceC,
  ]);

  /* ───────────────────────────── UI ───────────────────────────── */

  return (
    <main className="flex min-h-screen flex-col items-center gap-6">
      <h1 className="text-h1 mt-2">Sol-Claimer</h1>

      {!connected && (
        <div className="text-sm text-text-muted text-center">
          Please connect your wallet (top-right) to reclaim rent from empty token accounts.
        </div>
      )}

      {successBanner && (
        <div className="card-base p-3 text-sm text-emerald-400">
          {successBanner}{' '}
          <a className="underline" href="/donate">
            Donate
          </a>{' '}
          ·{' '}
          <a className="underline" href="/trading">
            Trading
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={scan}
          disabled={!connected || scanning}
          className="btn-pill"
        >
          {connected ? (scanning ? 'Scanning…' : 'Scan') : 'Connect wallet first'}
        </button>
        {atas.length > 0 && (
          <>
            <button className="btn-pill" onClick={() => toggleAll(true)}>
              Select all
            </button>
            <button className="btn-pill" onClick={() => toggleAll(false)}>
              Unselect all
            </button>
          </>
        )}
      </div>

      {connected && (
        <section className="w-full max-w-5xl space-y-4">
          <div className="text-sm text-text-muted">
            {atas.length > 0 ? (
              <>
                Found empty token accounts: <b className="text-text">{atas.length}</b> • Selected{' '}
                <b className="text-text">{selectedList.length}</b> • Total rent (selected){' '}
                <b className="text-text">{fmtSOL(selectedList.reduce((s, a) => s + a.rentLamports, 0))} SOL</b>
              </>
            ) : scanning ? (
              <>Scanning for empty token accounts…</>
            ) : (
              <>
                Click <b>Scan</b> to detect empty token accounts.
              </>
            )}
          </div>

          {/* ATAs grid */}
          {atas.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {atas.map((a) => {
                const k = a.ata.toBase58();
                const displayName =
                  a.meta?.name ||
                  (a.meta?.symbol
                    ? `${a.meta.symbol}`
                    : `${a.mint.slice(0, 4)}…${a.mint.slice(-4)}`);
                const badgeText = (
                  a.meta?.symbol?.slice(0, 2) ||
                  a.meta?.name?.slice(0, 2) ||
                  a.mint.slice(0, 2)
                ).toUpperCase();

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
                        <img
                          src={a.meta.image}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover border border-border"
                        />
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
                    <div className="text-[11px] text-text-muted font-mono truncate">
                      {k}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Summary + Execute */}
          {selectedList.length > 0 && (
            <div className="card-base p-4 text-small space-y-2">
              <div className="text-h2">Summary</div>
              <div>
                Estimated network fee (total): <b>~{fmtSOL(estFeeLamports)} SOL</b>
              </div>
              <div className="text-[12px] text-text-muted">
                We do not charge any additional fees; this service is completely free.
              </div>
              <div>
                Net to you: <b>{fmtSOL(Math.max(0, selectedList.reduce((s,a)=>s+a.rentLamports,0) - estFeeLamports))} SOL</b>
              </div>

              <button onClick={execute} disabled={busy} className="btn-pill-primary mt-1">
                {busy ? 'Signing…' : `Close ${selectedList.length} ATA`}
              </button>
            </div>
          )}

          {/* Recovery report */}
          {(lastRecoveredLamports > 0 || lifetime) && (
            <div className="card-base p-4 text-sm space-y-1">
              <div className="text-h2">Recovery report</div>
              {lastRecoveredLamports > 0 && (
                <div>
                  Recovered in last operation: <b>{fmtSOL(lastRecoveredLamports)} SOL</b>
                </div>
              )}
              {lifetime && (
                <>
                  <div>
                    Lifetime recovered: <b>{fmtSOL(lifetime.totalReclaimedLamports)} SOL</b>
                  </div>
                  <div>
                    Lifetime closed ATAs: <b>{lifetime.totalClosed}</b>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Transactions + raw log */}
          {(lastTxSigs.length > 0 || log) && (
            <div className="space-y-3">
              {lastTxSigs.length > 0 && (
                <div className="card-base p-3 text-sm">
                  <div className="font-medium mb-1">Transaction links (Solscan)</div>
                  <ul className="list-disc pl-5 space-y-1 break-all">
                    {lastTxSigs.map((s) => (
                      <li key={s}>
                        <a
                          className="underline"
                          href={`https://solscan.io/tx/${s}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {log && (
                <pre className="card-base p-3 whitespace-pre-wrap text-small">
                  {log}
                </pre>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
