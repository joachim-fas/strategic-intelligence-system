/**
 * GET  /api/v1/scenarios — List all scenarios
 * POST /api/v1/scenarios — Create a new scenario
 */

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";

function db() {
  const d = new Database(path.join(process.cwd(), "local.db"));
  d.pragma("journal_mode = WAL");
  d.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'custom',
      probability REAL DEFAULT 0.5,
      timeframe TEXT,
      key_drivers TEXT,
      impacts TEXT,
      source TEXT DEFAULT 'user',
      source_query TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return d;
}

export async function GET() {
  const d = db();
  const rows = d.prepare(
    "SELECT * FROM scenarios ORDER BY updated_at DESC"
  ).all();
  d.close();

  const scenarios = (rows as any[]).map((r) => ({
    ...r,
    key_drivers: r.key_drivers ? JSON.parse(r.key_drivers) : [],
    impacts: r.impacts ? JSON.parse(r.impacts) : [],
  }));

  return NextResponse.json({ scenarios });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { name, description, type, probability, timeframe, key_drivers, impacts, source, source_query } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = randomUUID();
  const d = db();

  d.prepare(`
    INSERT INTO scenarios (id, name, description, type, probability, timeframe, key_drivers, impacts, source, source_query)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    description ?? null,
    type ?? "custom",
    probability ?? 0.5,
    timeframe ?? null,
    key_drivers ? JSON.stringify(key_drivers) : null,
    impacts ? JSON.stringify(impacts) : null,
    source ?? "user",
    source_query ?? null,
  );

  const row = d.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as any;
  d.close();

  return NextResponse.json({
    scenario: {
      ...row,
      key_drivers: row.key_drivers ? JSON.parse(row.key_drivers) : [],
      impacts: row.impacts ? JSON.parse(row.impacts) : [],
    },
  });
}
