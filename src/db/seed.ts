/**
 * Database Seed Script
 *
 * Populates the database with:
 * 1. All mega/macro trends from curated sources
 * 2. Data source registry (42 sources)
 * 3. Initial score log entries
 *
 * Works with both PostgreSQL (Supabase) and SQLite (local dev).
 *
 * Run with: npx tsx src/db/seed.ts
 */

import { megaTrends } from "../lib/mega-trends";
import { SOURCE_REGISTRY } from "../lib/trend-sources";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const isPg = databaseUrl.startsWith("postgres");

  if (isPg) {
    await seedPostgres(databaseUrl);
  } else {
    await seedSqlite();
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL seeding (Supabase)
// ---------------------------------------------------------------------------
async function seedPostgres(connectionString: string) {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("./schema");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Seeding PostgreSQL database...");

  // 1. Seed trends
  console.log(`Inserting ${megaTrends.length} trends...`);
  for (const trend of megaTrends) {
    await db
      .insert(schema.trends)
      .values({
        slug: trend.id,
        name: trend.name,
        category: trend.category,
        tags: trend.tags,
        status: "confirmed",
        aggRelevance: trend.relevance,
        aggConfidence: trend.confidence,
        aggImpact: trend.impact,
        timeHorizon: trend.timeHorizon,
        metadata: {
          quadrant: trend.quadrant,
          signalCount: trend.signalCount,
          topSources: trend.topSources,
          velocity: trend.velocity,
          ring: trend.ring,
        },
      })
      .onConflictDoUpdate({
        target: schema.trends.slug,
        set: {
          aggRelevance: trend.relevance,
          aggConfidence: trend.confidence,
          aggImpact: trend.impact,
          updatedAt: new Date(),
        },
      });
  }

  // 2. Seed data sources
  console.log(`Inserting ${Object.keys(SOURCE_REGISTRY).length} data sources...`);
  for (const [key, source] of Object.entries(SOURCE_REGISTRY)) {
    await db
      .insert(schema.dataSources)
      .values({
        name: key,
        displayName: source.name,
        isActive: source.access !== "paid",
        runInterval: source.frequency || "daily",
      })
      .onConflictDoNothing();
  }

  // 3. Seed initial score log
  console.log("Creating initial score snapshots...");
  const allTrends = await db.select().from(schema.trends);
  for (const trend of allTrends) {
    await db
      .insert(schema.scoreLog)
      .values({
        trendId: trend.id,
        relevance: trend.aggRelevance,
        confidence: trend.aggConfidence,
        impact: trend.aggImpact,
        signalCount: 0,
      });
  }

  console.log("PostgreSQL seeding complete.");
  await client.end();
}

// ---------------------------------------------------------------------------
// SQLite seeding (local dev)
// ---------------------------------------------------------------------------
async function seedSqlite() {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("./schema-sqlite");
  const path = await import("path");

  const dbPath = path.join(process.cwd(), "local.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  console.log("Seeding SQLite database at:", dbPath);

  // 1. Seed trends
  console.log(`Inserting ${megaTrends.length} trends...`);
  for (const trend of megaTrends) {
    const existing = db
      .select()
      .from(schema.trends)
      .where(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("drizzle-orm").eq(schema.trends.slug, trend.id)
      )
      .get();

    if (existing) {
      db.update(schema.trends)
        .set({
          description: trend.description || null,
          aggRelevance: trend.relevance,
          aggConfidence: trend.confidence,
          aggImpact: trend.impact,
          updatedAt: new Date().toISOString(),
        })
        .where(
          require("drizzle-orm").eq(schema.trends.slug, trend.id)
        )
        .run();
    } else {
      db.insert(schema.trends)
        .values({
          slug: trend.id,
          name: trend.name,
          description: trend.description || null,
          category: trend.category,
          tags: JSON.stringify(trend.tags),
          status: "confirmed",
          aggRelevance: trend.relevance,
          aggConfidence: trend.confidence,
          aggImpact: trend.impact,
          timeHorizon: trend.timeHorizon,
          metadata: JSON.stringify({
            quadrant: trend.quadrant,
            signalCount: trend.signalCount,
            topSources: trend.topSources,
            velocity: trend.velocity,
            ring: trend.ring,
          }),
        })
        .run();
    }
  }

  // 2. Seed data sources
  console.log(`Inserting ${Object.keys(SOURCE_REGISTRY).length} data sources...`);
  for (const [key, source] of Object.entries(SOURCE_REGISTRY)) {
    const existing = db
      .select()
      .from(schema.dataSources)
      .where(
        require("drizzle-orm").eq(schema.dataSources.name, key)
      )
      .get();

    if (!existing) {
      db.insert(schema.dataSources)
        .values({
          name: key,
          displayName: source.name,
          isActive: source.access !== "paid",
          runInterval: source.frequency || "daily",
        })
        .run();
    }
  }

  // 3. Seed initial score log
  console.log("Creating initial score snapshots...");
  const allTrends = db.select().from(schema.trends).all();
  for (const trend of allTrends) {
    db.insert(schema.scoreLog)
      .values({
        trendId: trend.id,
        relevance: trend.aggRelevance,
        confidence: trend.aggConfidence,
        impact: trend.aggImpact,
        signalCount: 0,
      })
      .run();
  }

  console.log("SQLite seeding complete.");
  sqlite.close();
}

// Run
seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
