import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ trendId: string }> }) {
  const { trendId } = await params;
  redirect(`/cockpit/${trendId}`);
}
