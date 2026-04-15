/**
 * /cockpit — Knowledge Cockpit (Server Component wrapper).
 * Interactive content lives in CockpitClient (client component).
 */

import CockpitClient from "./CockpitClient";

export default function CockpitPage() {
  return <CockpitClient />;
}
