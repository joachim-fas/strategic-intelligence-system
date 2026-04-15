/**
 * /trends — now a thin redirect to /verstehen?tab=trends.
 *
 * The trend overview (ALL trends grouped by Adopt/Trial/Assess/Hold) used to
 * be a standalone page with its own hero + TrendsClient shell. It now lives
 * inside the Knowledge Cockpit as the "Trends" tab alongside Radar, Netzwerk,
 * Signale, and Quellen — matching the user's model of "one cockpit, many
 * views". Existing bookmarks and internal links to /trends keep working via
 * this redirect.
 */

import { redirect } from "next/navigation";

export default function TrendsPage() {
  redirect("/verstehen?tab=trends");
}
