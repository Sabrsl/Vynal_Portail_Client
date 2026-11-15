import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

function localApi(){
  return {
    name:'vynal-local-api',
    apply:'serve',
    configureServer(server){
      const env=loadEnv(server.config.mode,server.config.root,'');
      if(!process.env.SUPABASE_URL&&env.SUPABASE_URL)process.env.SUPABASE_URL=env.SUPABASE_URL;
      if(!process.env.SUPABASE_SERVICE_ROLE_KEY&&env.SUPABASE_SERVICE_ROLE_KEY)process.env.SUPABASE_SERVICE_ROLE_KEY=env.SUPABASE_SERVICE_ROLE_KEY;
      server.middlewares.use('/api/clients',async(req,res)=>{
        if(req.method!=='POST'){
          res.statusCode=405;
          res.setHeader('Allow','POST');
          res.setHeader('Content-Type','application/json; charset=utf-8');
          res.end(JSON.stringify({error:'Méthode non autorisée'}));
          return;
        }
        try{
          const chunks=[];
          for await(const chunk of req)chunks.push(chunk);
          const raw=Buffer.concat(chunks).toString('utf8');
          req.body=raw?JSON.parse(raw):{};
        }catch{
          res.statusCode=400;
          res.setHeader('Content-Type','application/json; charset=utf-8');
          res.end(JSON.stringify({error:'Corps JSON invalide'}));
          return;
        }
        try{
          const handler=(await server.ssrLoadModule('/api/clients.js')).default;
          res.status=code=>{res.statusCode=code;return res;};
          res.json=body=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));return res;};
          await handler(req,res);
          if(!res.writableEnded)res.status(500).json({error:'Erreur interne du serveur'});
        }catch(error){
          console.error('Local API error',error);
          if(!res.writableEnded){
            res.statusCode=500;
            res.setHeader('Content-Type','application/json; charset=utf-8');
            res.end(JSON.stringify({error:'Erreur interne du serveur'}));
          }
        }
      });
    }
  };
}

export default defineConfig({plugins:[react(),localApi()]});
