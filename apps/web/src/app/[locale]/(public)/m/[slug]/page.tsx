import { Suspense } from "react";

// TODO(public-menu) : menu public d'un restaurant, accessible via QR code.
export default function PublicMenuPage({ params }: PageProps<"/[locale]/m/[slug]">) {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Menu public</h1>
      <Suspense fallback={<p>Chargement…</p>}>
        {params.then(({ slug }) => (
          <p>Restaurant : {slug} (placeholder)</p>
        ))}
      </Suspense>
    </main>
  );
}
