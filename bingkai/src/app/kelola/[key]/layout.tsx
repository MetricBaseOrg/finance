import KelolaTabs from "@/components/KelolaTabs";

export default async function KelolaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return (
    <div className="space-y-8">
      <KelolaTabs manageKey={key} />
      {children}
    </div>
  );
}
