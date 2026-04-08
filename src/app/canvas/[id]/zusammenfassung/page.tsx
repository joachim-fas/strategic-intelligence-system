"use client";

import { use } from "react";
import SessionSummaryView from "@/components/session/SessionSummaryView";

export default function ZusammenfassungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SessionSummaryView projectId={id} />;
}
