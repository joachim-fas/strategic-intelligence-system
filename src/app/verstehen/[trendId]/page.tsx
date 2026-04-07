import { redirect } from "next/navigation";
export default async function VerstehenTrendPage({ params }: { params: Promise<{ trendId: string }> }) {
  const { trendId } = await params;
  redirect(`/cockpit/${trendId}`);
}
