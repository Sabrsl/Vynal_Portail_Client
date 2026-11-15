# Portail client VYNAL AGENCY LTD (React + Vite + Supabase, déploiement Vercel)

Chaque client se connecte et voit uniquement ses données.

## Développement local

```bash
npm install
npm run dev
```

`npm run dev` sert aussi `/api/clients` en local : le plugin Vite charge `api/clients.js` avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis `.env`.
