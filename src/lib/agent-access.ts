export type AgentApp='mail'|'projects'
const BASE='https://aleksa-ai-team-production.up.railway.app/api/agent-apps/'
const key=(app:AgentApp)=>'team-house-agent-'+app
const boot=new Map<AgentApp,Promise<string>>()
export function hasAgentSession(app:AgentApp){return !!localStorage.getItem(key(app))}
export function clearAgentSession(app:AgentApp){localStorage.removeItem(key(app));boot.delete(app)}
export function agentSession(app:AgentApp):Promise<string>{
 const pending=boot.get(app);if(pending)return pending
 const connect=new URLSearchParams(location.hash.slice(1)).get('connect')
 // Consume the bootstrap fragment before requests or page content are rendered.
 if(connect)history.replaceState(null,'',location.pathname+location.search)
 const promise=(async()=>{
  if(connect){localStorage.removeItem(key(app));const r=await fetch(BASE+app+'/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:connect}),referrerPolicy:'no-referrer'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Sign-in could not be completed.');localStorage.setItem(key(app),d.token);return String(d.token)}
  const token=localStorage.getItem(key(app));if(!token)throw new Error('Open this app from April’s computer in Team House.');return token
 })();boot.set(app,promise);return promise
}
export async function agentRead<T>(app:AgentApp,path:string):Promise<T>{
 const token=await agentSession(app),r=await fetch(BASE+app+'/'+path,{headers:{Authorization:'Bearer '+token},referrerPolicy:'no-referrer',cache:'no-store'})
 const d=await r.json();if(!r.ok){if(r.status===401)clearAgentSession(app);throw new Error(d.error||'This view could not be loaded.')}return d
}
