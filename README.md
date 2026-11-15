# Portail client VYNAL AGENCY LTD (React + Vite + Supabase, déploiement Vercel)

Chaque client se connecte et voit uniquement ses données en FCFA : investissement, CA encaissé, marge, résultat net, évolution, actions fait/en cours/à venir, stratégies, messages internes, dépenses et comptes gérés. L'isolation est garantie par la base (Row Level Security), pas seulement par l'interface.

## Fonctionnement

- L'administrateur crée le compte de connexion et le dossier client depuis **Clients**.
- Le client ne peut jamais lire les données d'un autre client grâce aux politiques RLS Supabase.
- L'administrateur dispose d'un aperçu exact du portail client, en lecture seule, et peut gérer les données métier associées.
- Les mots de passe ne sont ni affichés ni stockés dans la base métier. L'administrateur peut définir un nouveau mot de passe temporaire et le transmettre par un canal sécurisé.
- La suppression d'un client retire son dossier, ses données et son compte d'authentification.

## 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez `supabase/schema.sql` pour une nouvelle installation.
3. Si la base existe déjà, exécutez ensuite `supabase/migrations/20261114_client_access.sql`, puis `supabase/migrations/20261115_client_portal_value.sql` pour la messagerie interne et les stratégies.
4. Dans **Authentication → Users**, créez votre utilisateur administrateur et cochez **Auto Confirm**.
5. Dans **SQL Editor**, exécutez :

   ```sql
   insert into profiles(id, role)
   select id, 'admin'
   from auth.users
   where email = 'VOTRE_EMAIL_ADMIN';
   ```

6. Dans **Project Settings → API**, notez l'URL et les clés `anon` et `service_role`.

## 2. Vercel

1. Importez le dossier dans Vercel depuis GitHub.
2. Configurez les variables suivantes :

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   La clé `service_role` est secrète et ne doit jamais avoir le préfixe `VITE_`.
3. Déployez, connectez-vous avec le compte administrateur puis créez les accès clients.

## Développement local

```bash
npm install
npm run dev
```

`npm run dev` sert aussi `/api/clients` en local : le plugin Vite charge `api/clients.js` avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis `.env`.

Pour reproduire exactement l'environnement Vercel :

```bash
npx vercel dev
```

## Vérification

```bash
npm run build
node --check api/clients.js
```

## Sécurité

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans une variable `VITE_`.
- Utilisez un gestionnaire de mots de passe tel que Bitwarden pour transmettre les accès temporaires.
- Activez la 2FA sur Supabase, Vercel et les comptes clients lorsque possible.
- Ne stockez aucun mot de passe de réseau social dans le portail : utilisez Meta Business Manager et TikTok Business Center.
