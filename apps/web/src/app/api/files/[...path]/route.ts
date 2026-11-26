// TODO(storage) : servir un fichier après contrôle d'accès.
// 1. storageKeyOrganizationId(key) pour connaître l'organisation propriétaire ;
// 2. fichier public (menu publié) OU requireTenant() sur cette organisation ;
// 3. getStorage().get(key) et réponse avec le bon Content-Type.
export function GET() {
  return Response.json({ error: "Not Implemented" }, { status: 501 });
}
