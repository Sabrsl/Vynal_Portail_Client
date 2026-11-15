import {sb} from './supabase';
export const N=v=>Number(v)||0;
export const F=n=>N(n).toLocaleString('fr-FR')+' FCFA';
export const STATUTS=['Fait','En cours','À venir'];
export const PAR_COMPTE=['months','audience','depenses','strategies'];
export const COL={
 months:{t:'Suivi mensuel',f:[['mois','Mois','m'],['pub','Publicité dépensée (FCFA)','n'],['honoraires','Honoraires agence (FCFA)','n'],['demandes','Demandes','n'],['ventes','Ventes payées','n'],['ca','CA encaissé (FCFA)','n'],['marge','Marge produits (FCFA)','n']]},
 audience:{t:"Évolution de l'audience",f:[['periode','Période'],['vuesPub','Vues publications','n'],['vuesLive','Vues LIVE','n'],['followers','Nouveaux followers','n'],['commentaires','Commentaires','n'],['partages','Partages','n']]},
 depenses:{t:'Dépenses publicitaires',f:[['date','Date','d'],['plateforme','Plateforme'],['campagne','Campagne'],['montant','Montant (FCFA)','n'],['justificatif','Justificatif']]},
 actions:{t:'Actions & recommandations',f:[['action','Action'],['statut','Statut','s'],['objectif','Objectif attendu']]},
 strategies:{t:'Stratégies & plan d’action',f:[['titre','Stratégie'],['statut','Statut','s'],['objectif','Objectif'],['prochaine_etape','Prochaine étape'],['date_debut','Date de début','d']]},
 comptes:{t:'Comptes gérés (jamais de mot de passe)',f:[['compte','Compte'],['plateforme','Plateforme'],['statut','Statut'],['visible','Visible par le client','b'],['acces',"Accès de l'agence"],['twofa','2FA (Oui/Non)'],['vues','Vues actuelles','n'],['vuesLive','Vues LIVE','n'],['abonnes','Abonnés','n']]}
};
export async function load(id){
  const [c,r,msg]=await Promise.all([
    sb.from('clients').select('*').eq('id',id).single(),
    sb.from('records').select('*').eq('client_id',id).order('id'),
    sb.from('client_messages').select('*').eq('client_id',id).order('created_at',{ascending:true})
  ]);
  const d={messages:[]};Object.keys(COL).forEach(k=>d[k]=[]);
  (r.data||[]).forEach(x=>d[x.kind].push({...x.data,_id:x.id}));
  d.messages=(msg.data||[]).map(x=>({...x,_id:x.id}));
  return {client:c.data,d};
}
