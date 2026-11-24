// TODO(billing) : vérifier la signature (PAYMENT_WEBHOOK_SECRET) puis traiter l'événement.
export function POST() {
  return Response.json({ error: "Not Implemented" }, { status: 501 });
}
