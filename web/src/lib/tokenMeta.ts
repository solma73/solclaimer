'use client';

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey as umiPk } from '@metaplex-foundation/umi';
import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';

export type TokenMeta = { name?: string; symbol?: string; image?: string };

const cache = new Map<string, TokenMeta>();

function cleanStr(s?: string) {
  if (!s) return undefined;
  return s.replace(/\0+$/g, '').trim() || undefined;
}

export async function fetchTokenMeta(
  rpc: string,
  mintStr: string,
  timeoutMs = 7000
): Promise<TokenMeta> {
  if (cache.has(mintStr)) return cache.get(mintStr)!;
  try {
    const umi = createUmi(rpc);
    const mint = umiPk(mintStr);
    const [metadataPda] = findMetadataPda(umi, { mint });
    const acct = await umi.rpc.getAccount(metadataPda);
    if (!acct) return {};

    // динамичен import за десериализация
    const { Metadata } = await import('@metaplex-foundation/mpl-token-metadata');
    // @ts-ignore
    const md = Metadata.deserialize(acct.data)[0] as any;

    // on-chain полета (могат да имат \0 padding)
    let name = cleanStr(md?.data?.name);
    let symbol = cleanStr(md?.data?.symbol);
    const uri = cleanStr(md?.data?.uri) || '';

    // off-chain JSON (fallback/override)
    let image: string | undefined;
    if (uri) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        // ipfs:// → gateway
        const url = uri.startsWith('ipfs://')
          ? `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`
          : uri;
        const res = await fetch(url, { signal: ctl.signal });
        if (res.ok) {
          const j = await res.json();
          // ако JSON има име/символ, предпочитаме тях
          name = cleanStr(j.name) ?? name;
          symbol = cleanStr(j.symbol) ?? symbol;
          image = cleanStr(j.image) || cleanStr(j.logo) || image;
          // ipfs image → gateway
          if (image?.startsWith('ipfs://')) {
            image = `https://ipfs.io/ipfs/${image.slice('ipfs://'.length)}`;
          }
        }
      } catch {
        // ignore
      } finally {
        clearTimeout(timer);
      }
    }

    const out: TokenMeta = { name, symbol, image };
    cache.set(mintStr, out);
    return out;
  } catch {
    return {};
  }
}