/**
 * /trends — now a thin redirect to /cockpit?tab=trends.
 *
 * The trend overview (ALL trends grouped by Adopt/Trial/Assess/Hold) lives
 * inside the Knowledge Cockpit as the "Trends" tab alongside Radar, Netzwerk,
 * Signale, and Quellen. Existing bookmarks and internal links to /trends
 * keep working via this redirect.
 */

import { redirect } from "next/navigation";

export default function TrendsPage() {
  redirect("/cockpit?tab=trends");
}
