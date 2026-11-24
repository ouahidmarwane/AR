import { Suspense } from "react";

// TODO(organizations) : dashboard de l'organisation (restaurants, menus, QR codes).
export default function DashboardPage({ params }: PageProps<"/[locale]/app/[org]">) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p>Chargement…</p>}>
        {params.then(({ org }) => (
          <p>Organisation : {org} (placeholder)</p>
        ))}
      </Suspense>
    </main>
  );
}
