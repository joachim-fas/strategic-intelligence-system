#!/usr/bin/env tsx
/**
 * tenant-bootstrap — promote a user to system admin and owner of every
 * active tenant. This is the "first admin" recovery hatch called out in
 * the QC report: without at least one `users.role = "admin"`, nobody
 * can reach /admin/tenants to create the first customer tenant.
 *
 * Usage:
 *   npm run tenant:bootstrap -- <email>
 *   npm run tenant:bootstrap -- <email> --tenant=<slug>      (scope to one tenant)
 *   npm run tenant:bootstrap -- <email> --system-only         (no tenant memberships, just role=admin)
 *
 * Idempotent: safe to run multiple times. Reports exactly what changed.
 *
 * What it does:
 *   1. Finds the user by email (case-insensitive). Exits with code 2 if
 *      the user does not exist — we explicitly do NOT create users here
 *      because that would bypass the NextAuth magic-link flow. Have the
 *      user sign in once, then run this script.
 *   2. Upgrades users.role to "admin" (if not already).
 *   3. Unless --system-only, iterates active tenants (or the one scoped
 *      via --tenant=<slug>) and upserts a membership with role=owner.
 *      Existing memberships are upgraded to owner if needed; kept as-is
 *      if already owner.
 *   4. Writes 'bootstrap.admin_promoted' / 'bootstrap.owner_added' audit
 *      entries so the history shows how the account was elevated.
 */

import Database from "better-sqlite3";
import path from "path";
import { ensureMultiTenantSchema, ensureDefaultTenant } from "../src/db/sqlite-helpers";

interface Args {
  email: string;
  tenantSlug?: string;
  systemOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const rest = argv.slice(2);
  let email: string | null = null;
  let tenantSlug: string | undefined;
  let systemOnly = false;
  for (const a of rest) {
    if (a.startsWith("--tenant=")) tenantSlug = a.slice("--tenant=".length);
    else if (a === "--system-only") systemOnly = true;
    else if (!a.startsWith("--") && !email) email = a;
  }
  if (!email) {
    console.error("usage: npm run tenant:bootstrap -- <email> [--tenant=<slug>] [--system-only]");
    process.exit(1);
  }
  return { email: email.toLowerCase().trim(), tenantSlug, systemOnly };
}

function uuid(db: Database.Database): string {
  const row = db.prepare(`SELECT lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))),2) || '-' ||
    substr('89ab',abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))),2) || '-' ||
    lower(hex(randomblob(6))) AS id`).get() as { id: string };
  return row.id;
}

function main() {
  const args = parseArgs(process.argv);
  const dbPath = path.join(process.cwd(), "local.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // Schema must be up to date — otherwise the tenant tables may not exist.
  ensureMultiTenantSchema(db);
  ensureDefaultTenant(db);

  const user = db.prepare("SELECT id, email, role FROM users WHERE lower(email) = ?")
    .get(args.email) as { id: string; email: string; role: string } | undefined;
  if (!user) {
    console.error(`[bootstrap] no user with email ${args.email}.`);
    console.error(`           Have the user sign in via the magic-link flow first,`);
    console.error(`           then re-run this script to promote them.`);
    db.close();
    process.exit(2);
  }

  let roleChanged = false;
  if (user.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    roleChanged = true;
    console.log(`[bootstrap] promoted ${user.email} from '${user.role}' to 'admin'.`);
  } else {
    console.log(`[bootstrap] ${user.email} is already system admin.`);
  }

  if (args.systemOnly) {
    console.log(`[bootstrap] --system-only: skipping tenant memberships.`);
    if (roleChanged) logSystemAuditOnDefault(db, user.id);
    db.close();
    return;
  }

  // Targets = scoped tenant, or all active tenants.
  const targets = args.tenantSlug
    ? (db.prepare("SELECT id, name, slug FROM tenants WHERE slug = ?").all(args.tenantSlug) as Array<{ id: string; name: string; slug: string }>)
    : (db.prepare("SELECT id, name, slug FROM tenants WHERE archived_at IS NULL ORDER BY created_at ASC").all() as Array<{ id: string; name: string; slug: string }>);

  if (targets.length === 0) {
    console.error(`[bootstrap] no matching tenants (slug='${args.tenantSlug ?? "<all active>"}').`);
    db.close();
    process.exit(3);
  }

  let added = 0;
  let upgraded = 0;
  let kept = 0;
  const insertMembership = db.prepare(`INSERT INTO tenant_memberships
    (id, tenant_id, user_id, role, invited_by, joined_at)
    VALUES (?, ?, ?, 'owner', ?, datetime('now'))`);
  const upgradeMembership = db.prepare(`UPDATE tenant_memberships
    SET role = 'owner' WHERE tenant_id = ? AND user_id = ? AND role != 'owner'`);
  const auditInsert = db.prepare(`INSERT INTO tenant_audit_log
    (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, ?, ?)`);

  for (const t of targets) {
    const existing = db.prepare("SELECT role FROM tenant_memberships WHERE tenant_id = ? AND user_id = ?")
      .get(t.id, user.id) as { role: string } | undefined;
    if (!existing) {
      insertMembership.run(uuid(db), t.id, user.id, user.id);
      auditInsert.run(uuid(db), t.id, user.id, "bootstrap.owner_added", JSON.stringify({ email: user.email, via: "script" }));
      added += 1;
      console.log(`[bootstrap]   ${t.slug}: added as owner.`);
    } else if (existing.role !== "owner") {
      upgradeMembership.run(t.id, user.id);
      auditInsert.run(uuid(db), t.id, user.id, "bootstrap.role_upgraded", JSON.stringify({ email: user.email, from: existing.role, to: "owner" }));
      upgraded += 1;
      console.log(`[bootstrap]   ${t.slug}: upgraded from '${existing.role}' to owner.`);
    } else {
      kept += 1;
    }
  }

  if (roleChanged) {
    // Attach the system-role-change audit entry to the first tenant so
    // the action is discoverable under /admin/audit (there is no tenant-
    // less audit table on purpose — admins always look inside a tenant).
    auditInsert.run(uuid(db), targets[0].id, user.id, "bootstrap.admin_promoted", JSON.stringify({ email: user.email }));
  }

  console.log(`[bootstrap] done. memberships added: ${added}, upgraded: ${upgraded}, kept: ${kept}.`);
  db.close();
}

function logSystemAuditOnDefault(db: Database.Database, userId: string) {
  const def = db.prepare("SELECT id FROM tenants WHERE slug = 'default'").get() as { id: string } | undefined;
  if (!def) return;
  db.prepare(`INSERT INTO tenant_audit_log (id, tenant_id, actor_user_id, action, target)
    VALUES (?, ?, ?, 'bootstrap.admin_promoted', '{"via":"script","systemOnly":true}')`)
    .run(uuid(db), def.id, userId);
}

main();
