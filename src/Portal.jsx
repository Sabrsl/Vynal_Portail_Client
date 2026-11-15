import {useEffect,useMemo,useState} from 'react';
import {ComposedChart,Bar,LineChart,Line,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer,CartesianGrid} from 'recharts';
import {sb} from './supabase';
import Pager from './Pager';
import {load,N,F,StatusBadge} from './lib';

const tip={contentStyle:{background:'#16161b',border:'1px solid #2a2a33',borderRadius:10,color:'#f4f4f1',fontSize:13},labelStyle:{color:'#9b9ba7'}};
const CONTACT_EMAIL='vynal.app@gmail.com';
const WHATSAPP_NUMBER=(import.meta.env.VITE_WHATSAPP_NUMBER||'').replace(/[^\d]/g,'');
const ACTION_SECTIONS=[
  {statut:'Fait',title:'Ce qui a été fait',hint:'Actions terminées et résultats obtenus.'},
  {statut:'En cours',title:'Ce qui se passe maintenant',hint:'Actions en cours de réalisation.'},
  {statut:'À venir',title:'Ce qui va être fait',hint:'Prochaines actions planifiées.'}
];
const gmail=(client,note='')=>`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(`Portail partenaire — ${client?.name||'Demande'}`)}&body=${encodeURIComponent(`Bonjour,\n\nJe suis ${client?.name||'un partenaire'} et j'aimerais échanger au sujet de mon portail.${note?`\n\n${note}`:''}\n\nCordialement,\n${client?.name||''}`)}`;
const whatsapp=(client,note='')=>{
  const text=`Bonjour VYNAL, je suis ${client?.name||'un partenaire'} et j'aimerais échanger depuis mon portail.${note?` ${note}`:''}`;
  return WHATSAPP_NUMBER?`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
};
const periodIsDate=x=>/^\d{4}-\d{2}/.test(String(x));
const num=(obj,keys)=>{for(const k of keys)if(obj?.[k]!==undefined&&obj?.[k]!==null&&obj?.[k]!=='')return N(obj[k]);return 0;};
const monthMarge=x=>x.marge===undefined||x.marge===null||x.marge===''?N(x.ca)-N(x.pub)-N(x.honoraires):N(x.marge);
const I=d=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICO={
  trend:I(<><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>),
  live:I(<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>),
  users:I(<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.4 2.9-5.5 5.5-5.5s4.9 2.1 5.5 5.5"/><path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.9M17.5 14.9c1.8.7 3 2.4 3.4 5.1"/></>),
  eye:I(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>),
  chat:I(<path d="M20 12a8 8 0 0 1-8 8c-1.3 0-2.5-.3-3.6-.9L4 21l1.8-4.4A8 8 0 1 1 20 12Z"/>),
  share:I(<><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="5.5" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><path d="m8.2 10.9 6.6-3.8M8.2 13.1l6.6 3.8"/></>),
  wallet:I(<><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><circle cx="16.8" cy="14.8" r="1.3"/></>),
  chart:I(<><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8.5 16v-4.5M12.5 16V8.5M16.5 16v-6"/></>),
  target:I(<><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></>),
  check:I(<><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/></>),
  clock:I(<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>)
};
const Stat=({icon,label,value,accent='#d4af37',cls='',sub})=><div className={['k',cls].filter(Boolean).join(' ')} style={{'--acc':accent}}><span className="k-ic">{icon}</span><div className="k-txt"><small>{label}</small><b>{value}</b>{sub&&<em>{sub}</em>}</div></div>;

export function Dashboard({client,d,userId,reload,preview}){
  const [acc,setAcc]=useState('');
  const [showMessage,setShowMessage]=useState(false);
  const [message,setMessage]=useState({subject:'',message:''});
  const [sending,setSending]=useState(false);
  const [sendResult,setSendResult]=useState(null);
  const [msgPage,setMsgPage]=useState(1);
  const [msgSort,setMsgSort]=useState('new');

  const comptes=(d.comptes||[]).filter(x=>x.visible!==false);
  const visibleIds=new Set(comptes.map(x=>String(x._id)));
  const byAcc=x=>!acc||String(x.compte_id)===acc;
  const linked=x=>!x.compte_id||visibleIds.has(String(x.compte_id));
  const mm=(d.months||[]).filter(x=>byAcc(x)&&linked(x));
  const aa=(d.audience||[]).filter(x=>byAcc(x)&&linked(x));
  const dp=(d.depenses||[]).filter(x=>byAcc(x)&&linked(x));
  const strategies=(d.strategies||[]).filter(x=>byAcc(x)&&linked(x));
  const messages=useMemo(()=>[...(d.messages||[])]
    .sort((a,b)=>{
      const direction=msgSort==='new'?-1:1;
      return direction*String(a.created_at||'').localeCompare(String(b.created_at||''));
    }),[d.messages,msgSort]);
  const unreadMessages=(d.messages||[]).filter(m=>m.sender==='admin'&&!m.client_read_at);

  const m=[...mm].sort((a,b)=>String(a.mois).localeCompare(String(b.mois)));
  const shown=acc?comptes.filter(x=>String(x._id)===acc):comptes;
  const C=k=>shown.reduce((s,x)=>s+N(x[k]),0);
  const tasksDone=(d.actions||[]).filter(a=>a.statut==='Fait').length;
  const tasksOpen=(d.actions||[]).filter(a=>a.statut==='En cours').length;
  const strategiesActive=strategies.filter(s=>s.statut==='En cours').length;
  const cname=cid=>{const c=(d.comptes||[]).find(x=>String(x._id)===String(cid));return c?`${c.compte} · ${c.plateforme}`:'Tous les comptes';};

  const md=m.map(x=>({mois:x.mois,'Investissement':N(x.pub)+N(x.honoraires),'CA encaissé':N(x.ca),'Marge produits':monthMarge(x)}));
  const totInv=m.reduce((s,x)=>s+N(x.pub)+N(x.honoraires),0);
  const totCa=m.reduce((s,x)=>s+N(x.ca),0);
  const audienceData=aa.map(a=>({
    periode:a.periode||a.date||a.mois||'—',
    vuesPub:num(a,['vuesPub','vues_publications','vuesPublication','vues']),
    vuesLive:num(a,['vuesLive','vues_live','vuesLivePub','live']),
    followers:num(a,['followers','nouveauxFollowers','abonnés','abonnes']),
    commentaires:num(a,['commentaires']),
    partages:num(a,['partages'])
  }));
  if(audienceData.length&&audienceData.every(x=>periodIsDate(x.periode)))audienceData.sort((a,b)=>String(a.periode).localeCompare(String(b.periode)));
  const audTotals=audienceData.reduce((s,x)=>({vuesPub:s.vuesPub+N(x.vuesPub),vuesLive:s.vuesLive+N(x.vuesLive),followers:s.followers+N(x.followers),commentaires:s.commentaires+N(x.commentaires),partages:s.partages+N(x.partages)}),{vuesPub:0,vuesLive:0,followers:0,commentaires:0,partages:0});
  const totalViews=audTotals.vuesPub+audTotals.vuesLive;
  const periodViews=audienceData.map(x=>N(x.vuesPub)+N(x.vuesLive));
  const viewsGrowth=periodViews.length>1&&periodViews[0]>0?Math.round((periodViews[periodViews.length-1]-periodViews[0])/periodViews[0]*100):null;
  const growthText=viewsGrowth===null?'Historique en cours de collecte':viewsGrowth>=0?`+${viewsGrowth}% depuis la 1ʳᵉ période`:`${viewsGrowth}% depuis la 1ʳᵉ période`;

  const MSGS_PER_PAGE=2;
  const {pageItems,pageCount,currentPage}=useMemo(()=>{
    const totalPages=Math.max(1,Math.ceil(messages.length/MSGS_PER_PAGE));
    const current=Math.min(msgPage,totalPages);
    return {pageItems:messages.slice((current-1)*MSGS_PER_PAGE,current*MSGS_PER_PAGE),pageCount:totalPages,currentPage:current};
  },[messages,msgPage]);

  const sendMessage=async e=>{
    e.preventDefault();
    if(!userId){setSendResult({type:'error',text:'Session expirée. Reconnectez-vous.'});return;}
    setSending(true);setSendResult(null);
    const {error}=await sb.from('client_messages').insert({
      client_id:client.id,author_id:userId,sender:'client',channel:'internal',
      subject:message.subject,message:message.message,
      contact_email:client?.connection_email||client?.email||''
    });
    setSending(false);
    if(error){setSendResult({type:'error',text:error.message});return;}
    setSendResult({type:'success',text:'Message envoyé à l’équipe VYNAL.'});
    setMessage({subject:'',message:''});setShowMessage(false);
    if(reload)reload();
  };

  const printDate=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  const note=message.message.trim();

  useEffect(()=>{setMsgPage(1)},[msgSort]);
  useEffect(()=>{
    if(preview)return;
    const unread=(d.messages||[]).filter(m=>m.sender==='admin'&&!m.client_read_at).map(m=>m.id);
    if(!unread.length)return;
    sb.from('client_messages').update({client_read_at:new Date().toISOString()}).in('id',unread).then(()=>reload?.());
  },[d.messages,client.id,reload]);

  return <>
    <div className="print-only"><div className="print-head"><div><p className="eyebrow">VYNAL AGENCY LTD</p><h1>Rapport partenaire — {client?.name}</h1><p className="muted">Édité le {printDate}</p></div><div className="print-contact">vynal.app@gmail.com<br/>contact@vynalapp.com</div></div></div>
    <div className="page-head"><div><p className="eyebrow">Portail partenaire</p><h1>{client?.name}</h1><p className="muted">Vue synthétique de vos performances, de vos résultats et des prochaines actions.</p></div><button className="ghost np" onClick={()=>window.print()}>Imprimer / PDF</button></div>
    {comptes.length>0&&<div className="acc-cloud"><span className="acc-cloud-label">Compte à visualiser</span><div className="acc-cloud-pills"><button className={['acc-pill',!acc&&'on'].filter(Boolean).join(' ')} onClick={()=>setAcc('')}>Tous les comptes</button>{comptes.map(x=><button key={x._id} className={['acc-pill',acc===String(x._id)&&'on'].filter(Boolean).join(' ')} onClick={()=>setAcc(acc===String(x._id)?'':String(x._id))}><b>{x.compte}</b><small>{x.plateforme}</small></button>)}</div></div>}
    <div className="bento">
      <Stat cls="hero" icon={ICO.trend} label="Vues cumulées" value={totalViews.toLocaleString('fr-FR')} accent="#d4af37" sub={growthText}/>
      <Stat cls="w3" icon={ICO.live} label="Vues LIVE" value={C('vuesLive').toLocaleString('fr-FR')} accent="#fb7185" sub="Temps réel"/>
      <Stat cls="w3" icon={ICO.users} label="Abonnés" value={C('abonnes').toLocaleString('fr-FR')} accent="#34d399"/>
      <Stat icon={ICO.eye} label="Vues actuelles" value={C('vues').toLocaleString('fr-FR')} accent="#60a5fa"/>
      <Stat icon={ICO.chat} label="Commentaires" value={audTotals.commentaires.toLocaleString('fr-FR')} accent="#a78bfa"/>
      <Stat icon={ICO.share} label="Partages" value={audTotals.partages.toLocaleString('fr-FR')} accent="#2dd4bf"/>
      <Stat icon={ICO.wallet} label="Investissement" value={F(totInv)} accent="#fbbf24"/>
      <Stat icon={ICO.chart} label="CA encaissé" value={F(totCa)} accent="#10b981"/>
      <Stat icon={ICO.target} label="Stratégies actives" value={strategiesActive} accent="#818cf8"/>
      <Stat cls="w3" icon={ICO.check} label="Tâches accomplies" value={tasksDone} accent="#a3e635"/>
      <Stat cls="w3" icon={ICO.clock} label="Actions en cours" value={tasksOpen} accent="#fb923c"/>
    </div>
    <div className="v">{!audienceData.length?'Les premières performances apparaîtront après le premier mois de suivi.':viewsGrowth===null?'La croissance de l’audience sera mesurée à partir de la prochaine période de reporting.':viewsGrowth>=0?`✔ Audience en progression : +${viewsGrowth}% de vues entre la première et la dernière période suivie.`:`Audience en cours d’optimisation : notre équipe ajuste la stratégie pour relancer la croissance des vues et de l’engagement.`}</div>

    <section className="panel contact-panel"><div className="panel-head"><h2>Contacter l’équipe VYNAL</h2><span>Réponse sous 24 h</span></div>
      <p className="muted">{preview?'Aperçu de ce que voit le partenaire.':'Posez une question, demandez un ajustement de stratégie ou un reporting complémentaire.'}</p>
      {!preview&&<div className="contact-actions"><a className="contact-btn mail" href={gmail(client,note)}>Envoyer un e-mail</a><a className="contact-btn wa" href={whatsapp(client,note)} target="_blank" rel="noreferrer">WhatsApp</a><button type="button" className="contact-btn internal" onClick={()=>setShowMessage(v=>!v)}>{showMessage?'Fermer le message':'Message interne'}</button></div>}
      {!preview&&showMessage&&<form className="f contact-form" onSubmit={sendMessage}><label>Objet<input required value={message.subject} onChange={e=>setMessage({...message,subject:e.target.value})} placeholder="Objet de votre demande"/></label><label>Message<textarea required rows={4} value={message.message} onChange={e=>setMessage({...message,message:e.target.value})} placeholder="Décrivez votre besoin, votre question ou votre retour…"/></label>{sendResult&&<div className={`notice ${sendResult.type}`}>{sendResult.text}</div>}<button disabled={sending}>{sending?'Envoi…':'Envoyer le message'}</button></form>}
      <div className="message-thread">
        <div className="message-thread-head">
          <h3>Messages échangés</h3>
          <div className="message-tools">
            {unreadMessages.length>0&&<span className="message-notification">{unreadMessages.length} nouveau{unreadMessages.length>1?'x':''} message{unreadMessages.length>1?'s':''}</span>}
            <select value={msgSort} onChange={e=>setMsgSort(e.target.value)} aria-label="Ordre des messages">
              <option value="new">Plus récents</option>
              <option value="old">Plus anciens</option>
            </select>
          </div>
        </div>
        {messages.length?
          <>
            {pageItems.map(msg=>{
              const isNew=msg.sender==='admin'&&!msg.client_read_at;
              return <article className={`msg-card ${isNew?'unread':''}`} key={msg._id||msg.id}>
                <div className="msg-meta"><b>{msg.sender==='admin'?'Agence VYNAL':'Vous'}</b><span>{msg.channel==='email'?'E-mail':msg.channel==='whatsapp'?'WhatsApp':'Interne'}</span><time>{msg.created_at?new Date(msg.created_at).toLocaleString('fr-FR'):'—'}</time>{isNew&&<em className="new-badge">Nouveau</em>}</div>
                <h4>{msg.subject||'Message'}</h4><p>{msg.message}</p>
              </article>;
            })}
            <Pager page={currentPage} pageCount={pageCount} total={messages.length} onChange={setMsgPage}/>
          </>
          :<p className="muted">Aucun message pour le moment.</p>}
      </div>
    </section>

    <section className="panel"><div className="panel-head"><h2>Activité mensuelle</h2><span>Investissement vs CA</span></div>{md.length?<div className="chart"><ResponsiveContainer><ComposedChart data={md}><CartesianGrid stroke="#26262f" strokeDasharray="3 3"/><XAxis dataKey="mois" stroke="#9b9ba7" fontSize={12}/><YAxis stroke="#9b9ba7" fontSize={12} allowDecimals={false}/><Tooltip {...tip}/><Legend/><Bar dataKey="Investissement" fill="#d4af37" radius={[4,4,0,0]}/><Bar dataKey="CA encaissé" fill="#34d399" radius={[4,4,0,0]}/><Line dataKey="Marge produits" stroke="#38bdf8" strokeWidth={2} dot={{r:2.5}}/></ComposedChart></ResponsiveContainer></div>:<div className="chart empty-chart"><p className="muted">Aucune donnée mensuelle pour le moment.</p></div>}</section>
    <section className="panel"><div className="panel-head"><h2>Évolution de l'audience</h2><span>{audienceData.length?`${audienceData.length} période(s) renseignée(s)`:'Aucune période renseignée'}</span></div>
      {audienceData.length?<><div className="audience-totals">{[['Vues publications',audTotals.vuesPub],['Vues LIVE',audTotals.vuesLive],['Nouveaux followers',audTotals.followers],['Commentaires',audTotals.commentaires],['Partages',audTotals.partages]].map(([l,v])=><div className="audience-total" key={l}><small>{l}</small><b>{N(v).toLocaleString('fr-FR')}</b></div>)}</div><div className="chart"><ResponsiveContainer><LineChart data={audienceData}><CartesianGrid stroke="#26262f" strokeDasharray="3 3"/><XAxis dataKey="periode" stroke="#9b9ba7" fontSize={12}/><YAxis stroke="#9b9ba7" fontSize={12} allowDecimals={false}/><Tooltip {...tip}/><Legend/><Line dataKey="vuesPub" name="Vues publications" stroke="#d4af37" strokeWidth={2} dot={{r:2.5}}/><Line dataKey="vuesLive" name="Vues LIVE" stroke="#38bdf8" strokeWidth={2} dot={{r:2.5}}/><Line dataKey="followers" name="Nouveaux followers" stroke="#34d399" strokeWidth={2} dot={{r:2.5}}/></LineChart></ResponsiveContainer></div></>:<div className="chart empty-chart"><p className="muted">Aucune donnée d’audience pour cette sélection. L’équipe peut la renseigner depuis l’administration.</p></div>}
    </section>

    <section className="panel"><div className="panel-head"><h2>Stratégie adoptée</h2><span>{strategiesActive} en cours</span></div>{strategies.length?<div className="sc rt"><table><thead><tr><th>Stratégie</th><th>Statut</th><th>Objectif</th><th>Prochaine étape</th><th>Compte</th></tr></thead><tbody>{strategies.map(s=><tr key={s._id}><td data-label="Stratégie"><b>{s.titre}</b></td><td data-label="Statut"><StatusBadge v={s.statut}/></td><td data-label="Objectif">{s.objectif||'—'}</td><td data-label="Prochaine étape">{s.prochaine_etape||'—'}</td><td data-label="Compte">{cname(s.compte_id)}</td></tr>)}</tbody></table></div>:<p className="muted">Aucune stratégie renseignée pour le moment.</p>}</section>

    {ACTION_SECTIONS.map(({statut,title,hint})=>{const r=(d.actions||[]).filter(a=>a.statut===statut);return r.length?<section className="panel" key={statut}><div className="panel-head"><h2><StatusBadge v={statut}/> {title} <small className="muted">({r.length})</small></h2><span>{hint}</span></div><div className="sc rt"><table><thead><tr><th>Action</th><th>Objectif attendu</th></tr></thead><tbody>{r.map(a=><tr key={a._id}><td data-label="Action">{a.action}</td><td data-label="Objectif attendu">{a.objectif}</td></tr>)}</tbody></table></div></section>:null})}

    <section className="panel"><div className="panel-head"><h2>Dépenses publicitaires</h2></div><div className="sc rt"><table><thead><tr><th>Date</th><th>Plateforme</th><th>Campagne</th><th>Montant</th><th>Justificatif</th></tr></thead><tbody>{dp.map(x=><tr key={x._id}><td data-label="Date">{x.date}</td><td data-label="Plateforme">{x.plateforme}</td><td data-label="Campagne">{x.campagne}</td><td data-label="Montant">{F(x.montant)}</td><td data-label="Justificatif">{x.justificatif}</td></tr>)}{dp.length===0&&<tr><td colSpan="5" className="empty">Aucune dépense renseignée pour le moment</td></tr>}<tr className="total"><th colSpan="3">Total</th><th colSpan="2">{F(dp.reduce((s,x)=>s+N(x.montant),0))}</th></tr></tbody></table></div></section>
    <section className="panel"><div className="panel-head"><h2>Comptes gérés</h2></div>{d.comptes.length&&!comptes.length?<p className="muted">Aucun compte géré ne vous est actuellement visible. Contactez l’agence.</p>:<div className="sc rt"><table><thead><tr><th>Compte</th><th>Plateforme</th><th>Statut</th><th>Accès agence</th><th>2FA</th><th>Vues actuelles</th><th>Vues LIVE</th><th>Abonnés</th></tr></thead><tbody>{shown.map(x=><tr key={x._id}><td data-label="Compte"><b>{x.compte}</b></td><td data-label="Plateforme">{x.plateforme}</td><td data-label="Statut"><StatusBadge v={x.statut}/></td><td data-label="Accès agence">{x.acces}</td><td data-label="2FA">{x.twofa}</td><td data-label="Vues actuelles">{N(x.vues).toLocaleString('fr-FR')}</td><td data-label="Vues LIVE">{N(x.vuesLive).toLocaleString('fr-FR')}</td><td data-label="Abonnés">{N(x.abonnes).toLocaleString('fr-FR')}</td></tr>)}{shown.length>0&&<tr className="total"><th colSpan="5">Total</th><td><b>{C('vues').toLocaleString('fr-FR')}</b></td><td><b>{C('vuesLive').toLocaleString('fr-FR')}</b></td><td><b>{C('abonnes').toLocaleString('fr-FR')}</b></td></tr>}{!shown.length&&<tr><td colSpan="8" className="empty">Aucun compte visible pour cette sélection</td></tr>}</tbody></table></div>}</section>
  </>;
}

export default function Portal({clientId,userId,preview}){
  const [s,setS]=useState(null);
  const reload=()=>load(clientId).then(setS);
  useEffect(()=>{reload()},[clientId]);
  return s?<Dashboard key={s.client?.id} client={s.client} d={s.d} userId={userId} reload={reload} preview={preview}/>:<p className="muted">Chargement…</p>;
}
