import {useEffect,useState} from 'react';import {sb} from './supabase';import Admin from './Admin';import Portal from './Portal';
const Shell=({children,out})=><><header><b>VYNAL AGENCY LTD · Portail client</b>{out&&<button onClick={()=>sb.auth.signOut()}>Déconnexion</button>}</header><main>{children}</main><footer>VYNAL AGENCY LTD · 71-75 Shelton Street, Covent Garden, London WC2H 9JQ · vynal.app@gmail.com</footer></>;
function Login(){
  const [e,setE]=useState(''),[p,setP]=useState(''),[m,setM]=useState('');
  const go=async ev=>{ev.preventDefault();const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)setM('Identifiants incorrects')};
  return <Shell><form className="card" onSubmit={go}><h1>Connexion</h1><input type="email" placeholder="E-mail" value={e} onChange={x=>setE(x.target.value)} required/><input type="password" placeholder="Mot de passe" value={p} onChange={x=>setP(x.target.value)} required/><button style={{width:'100%'}}>Se connecter</button>{m&&<p className="neg">{m}</p>}</form></Shell>;
}
export default function App(){
  const [s,setS]=useState(undefined),[p,setP]=useState(null);
  useEffect(()=>{sb.auth.getSession().then(({data})=>setS(data.session));const {data:l}=sb.auth.onAuthStateChange((_,x)=>setS(x));return()=>l.subscription.unsubscribe()},[]);
  useEffect(()=>{setP(null);if(s)sb.from('profiles').select('*').eq('id',s.user.id).single().then(({data})=>setP(data||false))},[s]);
  if(s===undefined)return null;
  if(!s)return <Login/>;
  if(p===null)return <Shell out>Chargement…</Shell>;
  if(!p)return <Shell out>Compte non autorisé. Contactez l'agence.</Shell>;
  return <Shell out>{p.role==='admin'?<Admin/>:<Portal clientId={p.client_id} userId={s.user.id}/>}</Shell>;
}
