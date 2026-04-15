/**
 * /settings/mandant — Owner/Admin-Einstellungen fuer den aktiven Mandanten.
 *
 * Gegenstueck zur System-Admin-Sicht unter /admin/mandanten/[id]: hier
 * konfiguriert der Tenant-Owner (oder tenant-admin) seine eigene Orga —
 * Name, Slug (nur Owner), Default-Zeitzone, Default-Locale, Default-
 * Context-Profile (Rolle/Industrie/Region fuer neue Queries).
 *
 * Auth: einfach die Client-Komponente zeigen — requireTenantRole(admin)
 * im API enforced alles serverseitig. Ohne Login landet der User auf
 * /auth/signin via Middleware.
 */

import { TenantSettingsClient } from "./TenantSettingsClient";

export const dynamic = "force-dynamic";

export default function TenantSettingsPage() {
  return <TenantSettingsClient />;
}
