/**
 * /admin/mandanten/[id] — legacy redirect to /admin/tenants/[id] (URL moved to English).
 */

import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tenants/${id}`);
}
