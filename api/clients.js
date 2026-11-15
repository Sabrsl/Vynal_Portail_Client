import {createClient} from '@supabase/supabase-js';

const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json=(res,status,body)=>res.status(status).json(body);
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const missingConfig=()=>!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY;

async function requireAdmin(req,res){
  if(missingConfig())return json(res,503,{error:'Configuration serveur Supabase manquante'}),null;
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const {data:userData,error:userError}=await admin.auth.getUser(token);
  if(userError||!userData?.user)return json(res,401,{error:'Session expirée. Reconnectez-vous.'}),null;
  const {data:profile,error:profileError}=await admin.from('profiles').select('role').eq('id',userData.user.id).single();
  if(profileError||profile?.role!=='admin')return json(res,403,{error:'Réservé à l’agence'}),null;
  return userData.user;
}

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return json(res,405,{error:'Méthode non autorisée'});
  }
  if(!await requireAdmin(req,res))return;

  const body=req.body||{};
  try{
    if(body.action==='delete'){
      const clientId=clean(body.id,36);
      const {data:client,error}=await admin.from('clients').select('id').eq('id',clientId).maybeSingle();
      if(error)return json(res,500,{error:'Impossible de vérifier ce client'});
      if(!client)return json(res,404,{error:'Client introuvable'});
      const {data:profiles,error:profileError}=await admin.from('profiles').select('id').eq('client_id',clientId);
      if(profileError)return json(res,500,{error:'Impossible de vérifier les accès du client'});
      for(const profile of profiles||[])await admin.auth.admin.deleteUser(profile.id);
      const {error:deleteError}=await admin.from('clients').delete().eq('id',clientId);
      if(deleteError)return json(res,500,{error:'Impossible de supprimer le dossier client'});
      return json(res,200,{ok:true});
    }

    const name=clean(body.name,120);
    const connectionEmail=clean(body.connection_email||body.email,254).toLowerCase();
    const password=typeof body.password==='string'?body.password:'';
    if(body.action==='reset_password'){
      if(!name&&!connectionEmail)return json(res,400,{error:'Client ou e-mail requis'});
      if(password.length<10)return json(res,400,{error:'Le nouveau mot de passe doit contenir au moins 10 caractères'});
      let query=admin.from('clients').select('id,name,connection_email').limit(2);
      if(connectionEmail)query=query.eq('connection_email',connectionEmail);
      else if(name)query=query.ilike('name',name.replace(/[%_]/g,''));
      const {data:clients,error}=await query;
      if(error)return json(res,500,{error:'Impossible de rechercher le client'});
      if(!clients?.length)return json(res,404,{error:'Client introuvable'});
      if(clients.length>1)return json(res,409,{error:'Plusieurs clients correspondent : utilisez l’e-mail de connexion'});
      const client=clients[0];
      const {data:profile,error:profileError}=await admin.from('profiles').select('id').eq('client_id',client.id).single();
      if(profileError)return json(res,500,{error:'Impossible de vérifier l’accès du client'});
      if(!profile)return json(res,409,{error:'Aucun accès utilisateur n’est associé à ce client'});
      const {error:updateError}=await admin.auth.admin.updateUserById(profile.id,{password});
      if(updateError)return json(res,400,{error:updateError.message});
      const now=new Date().toISOString();
      await admin.from('clients').update({password_reset_at:now}).eq('id',client.id);
      return json(res,200,{ok:true,message:'Mot de passe réinitialisé'});
    }

    if(!name||!connectionEmail||!password)return json(res,400,{error:'Nom, e-mail et mot de passe requis'});
    if(!EMAIL_RE.test(connectionEmail))return json(res,400,{error:'Adresse e-mail invalide'});
    if(password.length<10)return json(res,400,{error:'Le mot de passe doit contenir au moins 10 caractères'});

    const {data:existingClient}=await admin.from('clients').select('id').ilike('connection_email',connectionEmail.replace(/[%_]/g,'')).limit(1);
    if(existingClient?.length)return json(res,409,{error:'Un client utilise déjà cet e-mail de connexion'});
    const {data:existingUsers,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
    if(listError||!existingUsers)return json(res,500,{error:'Impossible de vérifier les comptes existants'});
    if((existingUsers.users||[]).some(user=>user.email?.toLowerCase()===connectionEmail))return json(res,409,{error:'Un compte existe déjà avec cet e-mail'});

    const {data:client,error:clientError}=await admin.from('clients').insert({name,connection_email:connectionEmail}).select('id').single();
    if(clientError)return json(res,400,{error:clientError.message});
    const {data:newUser,error:userError}=await admin.auth.admin.createUser({email:connectionEmail,password,email_confirm:true});
    if(userError||!newUser.user){
      await admin.from('clients').delete().eq('id',client.id);
      return json(res,400,{error:userError?.message||'Impossible de créer le compte de connexion'});
    }
    const now=new Date().toISOString();
    const {error:profileError}=await admin.from('profiles').insert({id:newUser.user.id,role:'client',client_id:client.id});
    if(profileError){
      await admin.auth.admin.deleteUser(newUser.user.id);
      await admin.from('clients').delete().eq('id',client.id);
      return json(res,500,{error:'Impossible de relier le compte au client'});
    }
    await admin.from('clients').update({access_created_at:now}).eq('id',client.id);
    return json(res,200,{ok:true,message:'Accès client créé'});
  }catch(error){
    console.error('Client administration error',error);
    return json(res,500,{error:'Erreur interne du serveur'});
  }
}
