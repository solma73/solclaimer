import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = '/app/data'; // или './data' – в зависимост от твоя Docker layout
const FILE = path.join(DATA_DIR, 'ata_stats.json');

// помагаме си с safe read/write
function readFile(): Record<string, any> {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeFile(data: Record<string, any>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[local/stats] write error:', e);
  }
}

/* ──────────────── ROUTES ──────────────── */

// GET /api/local/stats/<pubkey>
export async function GET(req: NextRequest, { params }: { params: { pubkey?: string } }) {
  const url = new URL(req.url);
  const pubkey = url.searchParams.get('pubkey');
  if (!pubkey) {
    return NextResponse.json({ error: 'missing pubkey' }, { status: 400 });
  }

  const all = readFile();
  const stats = all[pubkey] || { totalClosed: 0, totalReclaimedLamports: 0, events: [] };
  return NextResponse.json(stats);
}

// POST /api/local/stats  body: { pubkey, data }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.pubkey || !body?.data) {
    return NextResponse.json({ error: 'missing pubkey or data' }, { status: 400 });
  }

  const all = readFile();
  all[body.pubkey] = body.data;
  writeFile(all);
  return NextResponse.json({ ok: true });
}
