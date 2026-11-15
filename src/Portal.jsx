import {useEffect,useMemo,useState} from 'react';
import {ComposedChart,Bar,LineChart,Line,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer,CartesianGrid} from 'recharts';
import {sb} from './supabase';
import Pager from './Pager';
import {load,N,F} from './lib';

const tip={contentStyle:{background:'#16161b',border:'1px solid #2a2a33',borderRadius:10,color:'#f4f4f1',fontSize:13},labelStyle:{color:'#9b9ba7'}};
const CONTACT_EMAIL='vynal.app@gmail.com';
const WHATSAPP_NUMBER=(import.meta.env.VITE_WHATSAPP_NUMBER||'').replace(/[^\d]/g,'');
const ACTION_SECTIONS=[
  {statut:'Fait',title:'Ce qui a été fait',hint:'Actions terminées et résultats obtenus.'},
  {statut:'En cours',title:'Ce qui se passe maintenant',hint:'Actions en cours de réalisation.'},
  {statut:'À venir',title:'Ce qui va être fait',hint:'Prochaines actions planifiées.'}
];
const gmail=(client,note='')=>`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(`Portail client — ${client?.name||'Demande'}`)}&body=${encodeURIComponent(`Bonjour,\n\nJe suis ${client?.name||'un client'} et j'aimerais échanger au sujet de mon portail.${note?`\n\n${note}`:''}\n\nCordialement,\n${client?.name||''}`)}`;
const whatsapp=(client,note='')=>{
  const text=`Bonjour VYNAL, je suis ${client?.name||'un client'} et j'aimerais échanger depuis mon portail.${note?` ${note}`:''}`;
  return WHATSAPP_NUMBER?`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
};
const periodIsDate=x=>/^\d{4}-\d{2}/.test(String(x));
const num=(obj,keys)=>{for(const k of keys)if(obj?.[k]!==undefined&&obj?.[k]!==null&&obj?.[k]!=='')return N(obj[k]);return 0;};

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
    .filter(m=>String(m.sender)!=='admin'||!m.client_read_at)
    .sort((a,b)=>{
      const direction=msgSort==='new'?-1:1;
      return direction*String(a.created_at||'').localeCompare(String(b.created_at||''));
    }),[d.messages,msgSort]);
  const unreadMessages=(d.messages||[]).filter(m=>m.sender==='admin'&&!m.client_read_at);

  const m=[...mm].sort((a,b)=>String(a.mois).localeCompare(String(b.mois)));
  const T=k=>m.reduce((s,x)=>s+N(x[k]),0);
  const pub=T('pub'),fees=T('honoraires'),ca=T('ca');
  const inv=pub+fees,res=ca-inv;
  const shown=acc?comptes.filter(x=>String(x._id)===acc):comptes;
  const C=k=>shown.reduce((s,x)=>s+N(x[k]),0);
  const tasksDone=(d.actions||[]).filter(a=>a.statut==='Fait').length;
  const tasksOpen=(d.actions||[]).filter(a=>a.statut==='En cours').length;
  const strategiesActive=strategies.filter(s=>s.statut==='En cours').length;
  const cname=cid=>{const c=(d.comptes||[]).find(x=>String(x._id)===String(cid));return c?`${c.compte} · ${c.plateforme}`:'Tous les comptes';};

  const md=m.map(x=>{const investment=N(x.pub)+N(x.honoraires);return {mois:x.mois,'CA encaissé':N(x.ca),'Investissement':investment,'Résultat net':N(x.ca)-investment};});
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

  const K=(a,b,c,variant='')=><div className={`k ${variant}`.trim()}><small>{a}</small><b className={c}>{b}</b></div>;
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
    <div className="print-only"><div className="print-head"><div><p className="eyebrow">VYNAL AGENCY LTD</p><h1>Rapport client — {client?.name}</h1><p className="muted">Édité le {printDate}</p></div><div className="print-contact">vynal.app@gmail.com<br/>contact@vynalapp.com</div></div></div>
    <div className="page-head"><div><p className="eyebrow">Portail client</p><h1>{client?.name}</h1><p className="muted">Vue synthétique de votre investissement, de vos résultats et des prochaines actions.</p></div><button className="ghost np" onClick={()=>window.print()}>Imprimer / PDF</button></div>
    {comptes.length>0&&<div className="acc-cloud"><span className="acc-cloud-label">Compte à visualiser</span><div className="acc-cloud-pills"><button className={['acc-pill',!acc&&'on'].filter(Boolean).join(' ')} onClick={()=>setAcc('')}>Tous les comptes</button>{comptes.map(x=><button key={x._id} className={['acc-pill',acc===String(x._id)&&'on'].filter(Boolean).join(' ')} onClick={()=>setAcc(acc===String(x._id)?'':String(x._id))}><b>{x.compte}</b><small>{x.plateforme}</small></button>)}</div></div>}
    <div className="g">
      {K('Stratégies actives',strategiesActive,'', 'stat-violet')}
      {K('Vues actuelles',C('vues').toLocaleString('fr-FR'),'', 'stat-blue')}
      {K('Vues LIVE',C('vuesLive').toLocaleString('fr-FR'),'', 'stat-cyan')}
      {K('Abonnés',C('abonnes').toLocaleString('fr-FR'),'', 'stat-green')}
      {K('Tâches accomplies',tasksDone,'', 'stat-emerald')}
      {K('Actions en cours',tasksOpen,'', 'stat-amber')}
      {K('Investissement total',F(inv),'', 'stat-rose')}
      {K('CA encaissé',F(ca),'ok', 'stat-green')}
      {K('Résultat net',F(res),res<0?'neg':'ok', res<0?'stat-red':'stat-teal')}
    </div>
    <div className="v">{!inv&&!ca?'Les premiers résultats apparaîtront après le premier mois de suivi.':res>=0?'✔ Investissement rentabilisé : le CA encaissé couvre la publicité et les honoraires.':`Investissement en cours de rentabilisation : il reste ${F(-res)} de CA encaissé à générer pour couvrir publicité et honoraires.`}</div>

    <section className="panel contact-panel"><div className="panel-head"><h2>Contacter l’équipe VYNAL</h2><span>Réponse sous 24 h</span></div>
      <p className="muted">{preview?'Aperçu de ce que voit le client.':'Posez une question, demandez un ajustement de stratégie ou un reporting complémentaire.'}</p>
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

    <section className="panel"><div className="panel-head"><h2>Évolution mensuelle</h2><span>CA encaissé vs investissement</span></div>{md.length?<div className="chart"><ResponsiveContainer><ComposedChart data={md}><CartesianGrid stroke="#26262f" strokeDasharray="3 3"/><XAxis dataKey="mois" stroke="#9b9ba7" fontSize={12}/><YAxis stroke="#9b9ba7" fontSize={12} tickFormatter={v=>v.toLocaleString('fr-FR')}/><Tooltip {...tip} formatter={v=>F(v)}/><Legend/><Bar dataKey="CA encaissé" fill="#d4af37" radius={[4,4,0,0]}/><Bar dataKey="Investissement" fill="#3a3a46" radius={[4,4,0,0]}/><Line dataKey="Résultat net" stroke="#f87171" strokeWidth={2} dot={{r:2.5}}/></ComposedChart></ResponsiveContainer></div>:<div className="chart empty-chart"><p className="muted">Aucune donnée mensuelle pour le moment.</p></div>}</section>
    <section className="panel"><div className="panel-head"><h2>Évolution de l'audience</h2><span>{audienceData.length?`${audienceData.length} période(s) renseignée(s)`:'Aucune période renseignée'}</span></div>
      {audienceData.length?<><div className="audience-totals">{[['Vues publications',audTotals.vuesPub],['Vues LIVE',audTotals.vuesLive],['Nouveaux followers',audTotals.followers],['Commentaires',audTotals.commentaires],['Partages',audTotals.partages]].map(([l,v])=><div className="audience-total" key={l}><small>{l}</small><b>{N(v).toLocaleString('fr-FR')}</b></div>)}</div><div className="chart"><ResponsiveContainer><LineChart data={audienceData}><CartesianGrid stroke="#26262f" strokeDasharray="3 3"/><XAxis dataKey="periode" stroke="#9b9ba7" fontSize={12}/><YAxis stroke="#9b9ba7" fontSize={12} allowDecimals={false}/><Tooltip {...tip}/><Legend/><Line dataKey="vuesPub" name="Vues publications" stroke="#d4af37" strokeWidth={2} dot={{r:2.5}}/><Line dataKey="vuesLive" name="Vues LIVE" stroke="#38bdf8" strokeWidth={2} dot={{r:2.5}}/><Line dataKey="followers" name="Nouveaux followers" stroke="#34d399" strokeWidth={2} dot={{r:2.5}}/></LineChart></ResponsiveContainer></div></>:<div className="chart empty-chart"><p className="muted">Aucune donnée d’audience pour cette sélection. L’équipe peut la renseigner depuis l’administration.</p></div>}
    </section>

    <section className="panel"><div className="panel-head"><h2>Stratégie adoptée</h2><span>{strategiesActive} en cours</span></div>{strategies.length?<div className="sc"><table><thead><tr><th>Stratégie</th><th>Statut</th><th>Objectif</th><th>Prochaine étape</th><th>Compte</th></tr></thead><tbody>{strategies.map(s=><tr key={s._id}><td><b>{s.titre}</b></td><td><span className={s.statut==='En cours'?'cur':s.statut==='Fait'?'ok':'nx'}>{s.statut}</span></td><td>{s.objectif||'—'}</td><td>{s.prochaine_etape||'—'}</td><td>{cname(s.compte_id)}</td></tr>)}</tbody></table></div>:<p className="muted">Aucune stratégie renseignée pour le moment.</p>}</section>

    {ACTION_SECTIONS.map(({statut,title,hint})=>{const r=(d.actions||[]).filter(a=>a.statut===statut);return r.length?<section className="panel" key={statut}><div className="panel-head"><h2><span className={statut==='Fait'?'ok':statut==='En cours'?'cur':'nx'}>{title}</span> <small className="muted">({r.length})</small></h2><span>{hint}</span></div><div className="sc"><table><thead><tr><th>Action</th><th>Objectif attendu</th></tr></thead><tbody>{r.map(a=><tr key={a._id}><td>{a.action}</td><td>{a.objectif}</td></tr>)}</tbody></table></div></section>:null})}

    <section className="panel"><div className="panel-head"><h2>Dépenses publicitaires</h2></div><div className="sc"><table><thead><tr><th>Date</th><th>Plateforme</th><th>Campagne</th><th>Montant</th><th>Justificatif</th></tr></thead><tbody>{dp.map(x=><tr key={x._id}><td>{x.date}</td><td>{x.plateforme}</td><td>{x.campagne}</td><td>{F(x.montant)}</td><td>{x.justificatif}</td></tr>)}{dp.length===0&&<tr><td colSpan="5" className="empty">Aucune dépense renseignée pour le moment</td></tr>}<tr className="total"><th colSpan="3">Total</th><th colSpan="2">{F(dp.reduce((s,x)=>s+N(x.montant),0))}</th></tr></tbody></table></div></section>
    <section className="panel"><div className="panel-head"><h2>Comptes gérés</h2></div>{d.comptes.length&&!comptes.length?<p className="muted">Aucun compte géré ne vous est actuellement visible. Contactez l’agence.</p>:<div className="sc"><table><thead><tr><th>Compte</th><th>Plateforme</th><th>Statut</th><th>Accès agence</th><th>2FA</th><th>Vues actuelles</th><th>Vues LIVE</th><th>Abonnés</th></tr></thead><tbody>{shown.map(x=><tr key={x._id}><td>{x.compte}</td><td>{x.plateforme}</td><td>{x.statut}</td><td>{x.acces}</td><td>{x.twofa}</td><td>{N(x.vues).toLocaleString('fr-FR')}</td><td>{N(x.vuesLive).toLocaleString('fr-FR')}</td><td>{N(x.abonnes).toLocaleString('fr-FR')}</td></tr>)}{shown.length>0&&<tr className="total"><th colSpan="5">Total</th><td><b>{C('vues').toLocaleString('fr-FR')}</b></td><td><b>{C('vuesLive').toLocaleString('fr-FR')}</b></td><td><b>{C('abonnes').toLocaleString('fr-FR')}</b></td></tr>}{!shown.length&&<tr><td colSpan="8" className="empty">Aucun compte visible pour cette sélection</td></tr>}</tbody></table></div>}</section>
  </>;
}

export default function Portal({clientId,userId,preview}){
  const [s,setS]=useState(null);
  const reload=()=>load(clientId).then(setS);
  useEffect(()=>{reload()},[clientId]);
  return s?<Dashboard key={s.client?.id} client={s.client} d={s.d} userId={userId} reload={reload} preview={preview}/>:<p className="muted">Chargement…</p>;
}
