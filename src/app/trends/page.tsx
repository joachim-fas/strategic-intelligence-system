/**
 * /trends — Trend-Vollübersicht (Server Component wrapper).
 *
 * Previously redirected to /verstehen?tab=radar. Now renders a dedicated
 * trend overview page so users have a direct, scannable entry point to
 * ALL tracked trends (grouped by Adopt / Trial / Assess / Hold), without
 * having to cross the Knowledge Cockpit's tab switcher first.
 *
 * Interactive content lives in TrendsClient (client component).
 */

import TrendsClient from "./TrendsClient";

export default function TrendsPage() {
  return <TrendsClient />;
}
