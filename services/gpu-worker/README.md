# gpu-worker

Emplacement réservé au worker de génération 3D. **Vide pour l'instant.**

Il sera développé en phase finale (phase 5 de la roadmap, voir [docs/architecture.md](../../docs/architecture.md)) :

- génération de modèles 3D des plats (GLB / USDZ) à partir de photos avec **TRELLIS.2** ;
- exécution sur GPU loué via **Vast.ai** ;
- appelé par l'app web (`GPU_ENDPOINT_URL`, authentifié par `GPU_API_KEY`) ;
- renvoie le résultat par webhook signé (`GPU_WEBHOOK_SECRET`) sur `/api/webhooks/gpu`.

Le worker ne fait pas partie du workspace pnpm (Python / Docker probablement).
