import {useEffect,useState} from 'react';
import {sb} from './supabase';
import Portal from './Portal';
import Pager from './Pager';
import {COL,STATUTS,PAR_COMPTE,load,F,N} from './lib';

async function api(body){
  try{
    const {data}=await sb.auth.getSession();
    const token=data.session?.access_token;
    if(!token)return 'Session expirée. Reconnectez-vous.';
    const r=await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null);
    return r.ok?null:(j?.error||`Erreur ${r.status} : réponse inattendue du serveur`);
  }catch{return 'Impossible de contacter le serveur'}
}

function Editor({id,kind,rows,reload,comptes}){
  const def=COL[kind],linked=PAR_COMPTE.includes(kind);
  const [v,setV]=useState({}),[editing,setEditing]=useState(null);
  const cname=cid=>{const c=(comptes||[]).find(x=>String(x._id)===String(cid));return c?`${c.compte} · ${c.plateforme}`:'—';};
  const dataFrom=()=>{
    const data={};
    def.f.forEach(([k,,t])=>data[k]=v[k]??(t==='s'?STATUTS[0]:t==='b'?true:''));
    if(linked)data.compte_id=v.compte_id||null;
    return data;
  };
  const save=async e=>{
    e.preventDefault();
    const data=dataFrom();
    const q=editing?sb.from('records').update({data}).eq('id',editing._id):sb.from('records').insert({client_id:id,kind,data});
    const {error}=await q;
    if(error)return alert(error.message);
    setV({});setEditing(null);reload();
  };
  const startEdit=r=>{setEditing(r);setV({...r});};
  const cancel=()=>{setEditing(null);setV({});};
  const del=async rid=>{if(confirm('Supprimer cette donnée ?')){await sb.from('records').delete().eq('id',rid);reload()}};

  return <section className="panel">
    <div className="panel-head"><h2>{def.t}</h2><span>{rows.length} élément{rows.length>1?'s':''}</span></div>
    <div className="sc"><table><thead><tr>{def.f.map(f=><th key={f[0]}>{f[1]}</th>)}{linked&&<th>Compte</th>}<th/></tr></thead><tbody>
      {rows.length?rows.map(r=><tr key={r._id}>{def.f.map(f=><td key={f[0]}>{f[2]==='n'?(f[0]==='montant'?F(r[f[0]]):N(r[f[0]]).toLocaleString('fr-FR')):f[2]==='b'?(r[f[0]]?'Oui':'Non'):(r[f[0]]||'—')}</td>)}{linked&&<td>{cname(r.compte_id)}</td>}<td className="row-actions"><button className="ghost" onClick={()=>startEdit(r)}>Modifier</button><button className="danger" onClick={()=>del(r._id)}>Supprimer</button></td></tr>):<tr><td colSpan={def.f.length+(linked?2:1)} className="empty">Aucune donnée pour le moment</td></tr>}
    </tbody></table></div>
    <form className="f" onSubmit={save}>{def.f.map(([k,l,t])=>t==='s'?<select key={k} value={v[k]??STATUTS[0]} onChange={e=>setV({...v,[k]:e.target.value})}>{STATUTS.map(s=><option key={s}>{s}</option>)}</select>:t==='b'?<label key={k} className="chk"><input type="checkbox" checked={v[k]??true} onChange={e=>setV({...v,[k]:e.target.checked})}/> {l}</label>:<input key={k} required placeholder={l} type={t==='n'?'number':t==='d'?'date':t==='m'?'month':'text'} step="any" value={v[k]??''} onChange={e=>setV({...v,[k]:e.target.value})}/>)}{linked&&<select value={v.compte_id??''} onChange={e=>setV({...v,compte_id:e.target.value})}><option value="">Tous les comptes</option>{(comptes||[]).map(c=><option key={c._id} value={c._id}>{c.compte} · {c.plateforme}</option>)}</select>}<div className="form-actions">{editing&&<button type="button" className="ghost" onClick={cancel}>Annuler</button>}<button>{editing?'Enregistrer les modifications':'Ajouter'}</button></div></form>
  </section>;
}

function Messages({clientId,messages,reload}){
  const [replyTo,setReplyTo]=useState(null),[reply,setReply]=useState(''),[userId,setUserId]=useState(null),[busy,setBusy]=useState(false);
  const [page,setPage]=useState(1),[sort,setSort]=useState('new');
  useEffect(()=>{sb.auth.getUser().then(({data})=>setUserId(data.user?.id||null))},[]);
  const unreadIds=messages.filter(m=>m.sender==='client'&&!m.admin_read_at).map(m=>m.id);
  const unread=unreadIds.length;
  useEffect(()=>{
    if(!unreadIds.length)return;
    sb.from('client_messages').update({admin_read_at:new Date().toISOString()}).in('id',unreadIds).then(()=>reload());
  },[unreadIds.join(','),reload]);
  const mark=async id=>{const {error}=await sb.from('client_messages').update({admin_read_at:new Date().toISOString(),read_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else reload();};
  const send=async e=>{
    e.preventDefault();
    if(!replyTo||!userId)return alert('Session expirée. Reconnectez-vous.');
    setBusy(true);
    const original=messages.find(m=>m._id===replyTo);
    const {error}=await sb.from('client_messages').insert({client_id:clientId,author_id:userId,sender:'admin',channel:'internal',subject:`Re: ${original?.subject||'Message client'}`,message:reply,contact_email:original?.contact_email||'',admin_read_at:new Date().toISOString()});
    setBusy(false);
    if(error){alert(error.message);return;}
    setReply('');setReplyTo(null);reload();
  };
  const MSGS_PER_PAGE=2;
  const sorted=[...messages].sort((a,b)=>{
    const direction=sort==='new'?-1:1;
    return direction*String(a.created_at||'').localeCompare(String(b.created_at||''));
  });
  const pageCount=Math.max(1,Math.ceil(sorted.length/MSGS_PER_PAGE));
  const currentPage=Math.min(page,pageCount);
  const pageItems=sorted.slice((currentPage-1)*MSGS_PER_PAGE,currentPage*MSGS_PER_PAGE);
  useEffect(()=>setPage(1),[clientId,sort]);
  return <section className="panel"><div className="panel-head"><div><h2>Messages clients</h2><small className="muted">Cliquez sur « Répondre » pour traiter une demande.</small></div><div className="message-tools"><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Ordre des messages"><option value="new">Plus récents</option><option value="old">Plus anciens</option></select><span>{unread} non lu(s)</span></div></div>
    {messages.length?<div className="msg-list">{pageItems.map(m=>{const isUnread=m.sender==='client'&&!m.admin_read_at;return <article className={`msg-card ${isUnread?'unread':''}`} key={m._id||m.id}>
      <div className="msg-meta"><b>{m.sender==='admin'?'Agence':'Client'}</b><span>{m.channel==='email'?'E-mail':m.channel==='whatsapp'?'WhatsApp':'Interne'}</span><time>{m.created_at?new Date(m.created_at).toLocaleString('fr-FR'):'—'}</time>{isUnread&&<em className="new-badge">Nouveau</em>}</div>
      <h4>{m.subject||'Message'}</h4><p>{m.message}</p>
      <div className="msg-actions">{replyTo===m._id?<form className="f reply-form" onSubmit={send}><textarea required rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Votre réponse…"/><div className="reply-actions"><button disabled={busy}>{busy?'Envoi…':'Envoyer'}</button><button type="button" className="ghost" onClick={()=>{setReplyTo(null);setReply('')}}>Annuler</button></div></form>:<><button className="ghost" onClick={()=>{setReplyTo(m._id);setReply('')}}>Répondre</button>{isUnread&&<button className="ghost" onClick={()=>mark(m._id)}>Marquer lu</button>}</>}</div>
    </article>})}</div>:<p className="muted">Aucun message client pour le moment.</p>}
    <Pager page={currentPage} pageCount={pageCount} total={messages.length} onChange={setPage}/>
  </section>;
}

function ClientAdmin({c,back}){
  const [s,setS]=useState(null),[err,setErr]=useState(''),[notice,setNotice]=useState(''),[pass,setPass]=useState('');
  const [preview,setPreview]=useState(false);
  const reload=()=>load(c.id).then(setS);useEffect(()=>{reload()},[c.id]);
  const reset=async e=>{e.preventDefault();const er=await api({action:'reset_password',email:c.connection_email||c.email,password:pass});setErr(er||'');if(!er){setNotice('Mot de passe réinitialisé');setPass('');reload()}};
  const del=async()=>{if(!confirm(`Supprimer définitivement ${c.name} et son accès ?`))return;const e=await api({action:'delete',id:c.id});e?setErr(e):back()};
  return <><button className="back" onClick={back}>← Tous les clients</button><div className="page-head"><div><p className="eyebrow">Administration client</p><h1>{c.name}</h1><p>{c.connection_email||c.email||'E-mail non renseigné'} · accès créé le {c.access_created_at?new Date(c.access_created_at).toLocaleDateString('fr-FR'):'—'}</p></div><span className={`badge ${s?'on':'off'}`}>{s?'Portail actif':'Chargement'}</span><button className="ghost" onClick={()=>setPreview(v=>!v)}>{preview?'Quitter l’aperçu':'Aperçu portail client'}</button></div>{err&&<div className="notice error">{err}</div>}{notice&&<div className="notice success">{notice}</div>}
  {preview?<Portal clientId={c.id} userId={null} preview/>:s&&<><div className="summary-strip"><span>Investissement <b>{F(s.d.months.reduce((a,x)=>a+N(x.pub)+N(x.honoraires),0))}</b></span><span>CA encaissé <b>{F(s.d.months.reduce((a,x)=>a+N(x.ca),0))}</b></span><span>Résultat net <b>{F(s.d.months.reduce((a,x)=>a+N(x.ca)-N(x.pub)-N(x.honoraires),0))}</b></span><span>Données <b>{Object.keys(COL).reduce((a,k)=>a+(s.d[k]||[]).length,0)}</b></span><span>Tâches accomplies <b>{(s.d.actions||[]).filter(a=>a.statut==='Fait').length}</b></span><span>Stratégies actives <b>{(s.d.strategies||[]).filter(a=>a.statut==='En cours').length}</b></span><span>Vues actuelles <b>{s.d.comptes.reduce((a,x)=>a+N(x.vues),0).toLocaleString('fr-FR')}</b></span><span>Vues LIVE <b>{s.d.comptes.reduce((a,x)=>a+N(x.vuesLive),0).toLocaleString('fr-FR')}</b></span><span>Abonnés <b>{s.d.comptes.reduce((a,x)=>a+N(x.abonnes),0).toLocaleString('fr-FR')}</b></span></div><Messages clientId={c.id} messages={s.d.messages||[]} reload={reload}/><div className="grid2"><form className="panel" onSubmit={reset}><h2>Accès et sécurité</h2><p className="muted">Les mots de passe ne sont jamais affichés. Définissez un nouveau mot de passe temporaire à transmettre au client.</p><label>Nouveau mot de passe temporaire<input type="password" minLength={10} required value={pass} onChange={e=>setPass(e.target.value)}/></label><button>Réinitialiser le mot de passe</button></form><section className="panel danger-zone"><h2>Zone sensible</h2><p className="muted">La suppression retire définitivement le dossier, les données et le compte de connexion.</p><button className="danger" onClick={del}>Supprimer ce client</button></section></div>{Object.keys(COL).map(k=><Editor key={k} id={c.id} kind={k} rows={s.d[k]} reload={reload} comptes={s.d.comptes}/>)}</>}</>;
}

export default function Admin(){
  const [cs,setCs]=useState([]),[sel,setSel]=useState(null),[f,setF]=useState({name:'',email:'',password:''}),[err,setErr]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [unreadCounts,setUnreadCounts]=useState({});
  const [notification,setNotification]=useState(null);
  const loadUnreadCounts=async()=>{
    const {data,error}=await sb.from('client_messages').select('client_id,created_at').eq('sender','client').is('admin_read_at',null).order('created_at',{ascending:false});
    if(error){setErr(error.message);return;}
    const counts={};
    (data||[]).forEach(m=>{counts[m.client_id]=(counts[m.client_id]||0)+1});
    setUnreadCounts(counts);
    if(data?.length)setNotification(`Nouveau message client reçu · ${new Date(data[0].created_at).toLocaleString('fr-FR')}`);
  };
  const ld=()=>Promise.all([sb.from('clients').select('*').order('created_at'),loadUnreadCounts()]).then(([{data,error}])=>{if(error)setErr(error.message);else{setCs(data||[]);setErr('')}});useEffect(()=>{ld()},[]);
  useEffect(()=>{
    const channel=sb.channel('admin-client-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'client_messages'},payload=>{
      if(payload.new?.sender!=='client')return;
      ld();setNotification('Nouveau message client reçu.');
    }).subscribe();
    return()=>{sb.removeChannel(channel)};
  },[]);
  const create=async e=>{e.preventDefault();setBusy(true);setErr('');setNotice('');const er=await api({...f,connection_email:f.email});setBusy(false);if(er)setErr(er);else{setNotice('Accès client créé avec succès');setF({name:'',email:'',password:''});ld()}};
  if(sel)return <ClientAdmin c={sel} back={()=>{setSel(null);ld()}}/>;
  return <><div className="page-head"><div><p className="eyebrow">Espace agence</p><h1>Clients</h1><p>Créez des accès et pilotez la visibilité de chaque portail.</p></div><span className="badge">{cs.length} client{cs.length>1?'s':''}</span></div>{err&&<div className="notice error">{err}</div>}{notice&&<div className="notice success">{notice}</div>}
  {notification&&<div className="notice success admin-message-notification"><b>Notification :</b> {notification}<button type="button" className="ghost" onClick={()=>setNotification(null)}>Fermer</button></div>}
  <section className="panel"><div className="panel-head"><h2>Clients existants</h2><span>Gestion des accès</span></div><div className="sc"><table className="clients-table"><thead><tr><th>Client</th><th>E-mail de connexion</th><th>Accès créé</th><th>Messages non lus</th><th/></tr></thead><tbody>{cs.map(c=>{const count=unreadCounts[c.id]||0;return <tr key={c.id}><td><b>{c.name}</b></td><td>{c.connection_email||c.email||'—'}</td><td>{c.access_created_at?new Date(c.access_created_at).toLocaleDateString('fr-FR'):'—'}</td><td>{count?<span className="unread-count">{count} nouveau{count>1?'x':''}</span>:'—'}</td><td><button onClick={()=>setSel(c)}>Gérer</button></td></tr>})}{!cs.length&&<tr><td colSpan="5" className="empty">Aucun client pour le moment</td></tr>}</tbody></table></div></section>
  <section className="panel create-panel"><div><p className="eyebrow">Nouveau compte</p><h2>Créer l’accès d’un client</h2><p className="muted">Le client ne verra que son propre portail : résultats, actions, dépenses autorisées et comptes gérés.</p></div><form className="f create-form" onSubmit={create}><label>Nom du client<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>E-mail de connexion<input required type="email" autoComplete="username" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Mot de passe temporaire<input required minLength={10} type="password" autoComplete="new-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><small>10 caractères minimum. Transmettez-le de façon sécurisée puis réinitialisez-le si nécessaire.</small></label><button disabled={busy}>{busy?'Création…':'Créer l’accès'}</button></form></section></>;
}
