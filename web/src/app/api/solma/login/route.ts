// app/api/solma/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SOLMA_API_BASE = process.env.SOLMA_API_BASE!;       // напр. http://172.18.0.1:8780
const SOLMA_API_KEY_ATA = process.env.SOLMA_API_KEY_ATA!; // сървърен ключ (string)

export async function POST(req: NextRequest) {
  try {
    if (!SOLMA_API_BASE || !SOLMA_API_KEY_ATA) {
      return NextResponse.json({ ok: false, error: 'Server auth not configured' }, { status: 500 });
    }
    const body = await req.json().catch(() => ({}));
    const scopes: string[] = Array.isArray(body?.scopes) && body.scopes.length
      ? body.scopes.map(String)
      : ['ata_stats'];

    const upstream = await fetch(`${SOLMA_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'api_key', key: SOLMA_API_KEY_ATA, scopes }),
      redirect: 'manual',
    });

    const res = NextResponse.json({ ok: upstream.ok }, { status: upstream.status });
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) res.headers.append('set-cookie', setCookie);
    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: txt || `Upstream error ${upstream.status}` },
        { status: upstream.status, headers: res.headers }
      );
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'login route error' }, { status: 500 });
  }
}
