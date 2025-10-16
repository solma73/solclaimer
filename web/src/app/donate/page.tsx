"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function DonatePage() {
  const DONATION_ADDRESS = process.env.NEXT_PUBLIC_DONATION_ADDRESS || "";

  const [amount, setAmount] = useState<number>(0.25);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const amountStr = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0) return "";
    return amount.toFixed(3);
  }, [amount]);

  const payHref = useMemo(() => {
    if (!DONATION_ADDRESS || !amountStr) return "#";
    const params = new URLSearchParams({
      amount: amountStr,
      label: "Solma73 Donation",
      message: "Thank you for supporting the project!",
    });
    return `solana:${DONATION_ADDRESS}?${params.toString()}`;
  }, [DONATION_ADDRESS, amountStr]);

  function clamp(n: number) {
    if (!Number.isFinite(n)) return 0.01;
    return Math.min(50, Math.max(0.01, Number(n)));
  }

  const handleDonate = async () => {
    if (!DONATION_ADDRESS) return;
    try {
      setBusy(true);
      if (payHref && payHref !== "#") window.location.href = payHref;
    } finally {
      setTimeout(() => setBusy(false), 1200);
    }
  };

  const copyAddress = async () => {
    if (!DONATION_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-text">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-h1">Solclaimer</h1>
      </div>

      {/* Lead text (еднакво копие на тона от втората страница) */}
      <div className="card-base p-4 mb-6">
        <p className="text-sm text-text-muted">
          We do not charge any additional fees — you only pay the standard Solana network fees.
          Every donation is deeply appreciated and helps us improve the project. 🙏 You can also
          support us by using our partner referral links on the{" "}
          <Link
            href={process.env.NEXT_PUBLIC_TRADING_PATH || "/trader"}
            className="underline underline-offset-4 decoration-border hover:opacity-80"
          >
            Trading page
          </Link>.
        </p>
      </div>

      {/* Donation card */}
      <div className="card-base p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Make a donation (SOL)</h2>
          <p className="mt-1 text-small text-text-muted">
            Choose an amount and click Donate — your wallet will open via Solana Pay.
          </p>
        </div>

        {/* Amount controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-center">
          {/* Number input */}
          <div className="sm:col-span-1">
            <label className="block text-small text-text-muted mb-2">Amount (SOL)</label>
            <input
              type="number"
              min={0.01}
              max={50}
              step="0.01"
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(clamp(parseFloat(e.target.value)))}
              className="w-full rounded-xl border border-border bg-bg-raised px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="0.25"
              inputMode="decimal"
            />
          </div>

          {/* Slider */}
          <div className="sm:col-span-2">
            <label className="block text-small text-text-muted mb-2">Quick adjust</label>
            <input
              type="range"
              min={0.01}
              max={5}
              step={0.01}
              value={Math.min(5, Math.max(0.01, amount))}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-cyan-500"
            />
            <div className="mt-1 text-xs text-text-muted flex justify-between">
              <span>0.01</span><span>1</span><span>3</span><span>5 SOL</span>
            </div>
          </div>
        </div>

        {/* Address & copy */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-small">
            <div className="text-text-muted">Recipient</div>
            {DONATION_ADDRESS ? (
              <code className="mt-1 block truncate rounded-lg bg-bg-raised border border-border px-2 py-1">
                {DONATION_ADDRESS}
              </code>
            ) : (
              <span className="text-amber-400">
                Donation address is not set (.env.local → NEXT_PUBLIC_DONATION_ADDRESS)
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyAddress}
              disabled={!DONATION_ADDRESS}
              className="btn-pill"
              aria-label="Copy address"
            >
              {copied ? "Copied ✓" : "Copy address"}
            </button>

            <button
              onClick={handleDonate}
              disabled={!DONATION_ADDRESS || !amountStr || busy}
              className="btn-pill-primary"
            >
              {busy ? "Opening wallet…" : `Donate ${amountStr || ""} SOL`}
            </button>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-xs text-text-muted">
          Tip: If your wallet doesn't open automatically, you can paste the address above and send the selected amount manually.
        </p>
      </div>
    </div>
  );
}
