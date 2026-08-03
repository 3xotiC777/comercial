import { PublicClientApplication } from '@azure/msal-browser'

export type Status = 'Pendiente' | 'En proceso' | 'Finalizado'
export type Analyst = 'Diego' | 'Miguel' | 'Rony' | ''
export type Ticket = { id:string; spId:string; created_at:string; requester_name:string; requester_email:string; country:string; study:string; request_type:string; detail:string; status:Status; assignee:Analyst; attachment_name?:string }

const tenantId = '05e4f087-3719-4046-8fa3-286b1f5110f2'
const clientId = '373c64ec-c8ef-41bf-a2e9-bb2225bceb9a'
const scopes = ['User.Read', 'Sites.ReadWrite.All']
const redirectUri = window.location.hostname.endsWith('github.io') ? `${window.location.origin}/comercial/auth.html` : `${window.location.origin}/auth.html`
const msal = new PublicClientApplication({ auth:{ clientId, authority:`https://login.microsoftonline.com/${tenantId}`, redirectUri }, cache:{cacheLocation:'sessionStorage'} })

const norm = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const aliases:Record<string,string[]> = {
  ticket: ['Ticket','Id de ticket','Ticket id','Id ticket'],
  name: ['Solicitante','Nombre solicitante','Nombre completo','Nombre'],
  email: ['Correo','Correo solicitante','Correo corporativo','Email'],
  country: ['Pais','País'], study: ['Estudio'], type: ['Tipo de solicitud','Tipo'],
  detail: ['Detalle','Detalle de solicitud','Solicitud'], status: ['Estado'],
  assignee: ['Responsable','Analista'], attachment: ['Archivo','Adjunto','Insumo'],
}
let context: {siteId:string;listId:string;driveId:string;columns:Map<string,string>} | null = null

async function token(interactive=false) {
  await msal.initialize()
  let account = msal.getActiveAccount() || msal.getAllAccounts()[0]
  if (!account && interactive) account = (await msal.loginPopup({scopes})).account || undefined
  if (!account) return null
  msal.setActiveAccount(account)
  try { return (await msal.acquireTokenSilent({scopes,account})).accessToken }
  catch { return interactive ? (await msal.acquireTokenPopup({scopes,account})).accessToken : null }
}
async function graph(path:string, accessToken:string, init:RequestInit={}) {
  const headers = new Headers(init.headers); headers.set('Authorization',`Bearer ${accessToken}`); headers.set('Content-Type','application/json')
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`,{...init,headers})
  if (!response.ok) throw new Error(`SharePoint respondió ${response.status}. Verifica tus permisos en la lista.`)
  return response.status === 204 ? null : response.json()
}
function field(columns:Map<string,string>, key:string) { return aliases[key].map(x=>columns.get(norm(x))).find(Boolean) }
function value(fields:Record<string,unknown>, columns:Map<string,string>, key:string) { const name=field(columns,key); return name ? String(fields[name] ?? '') : '' }
function set(fields:Record<string,unknown>, columns:Map<string,string>, key:string, data:unknown) { const name=field(columns,key); if(name) fields[name]=data }

async function getContext(accessToken:string) {
  if (context) return context
  const site = await graph('/sites/dichterneiracorp.sharepoint.com:/sites/reportingdn',accessToken)
  const lists = await graph(`/sites/${site.id}/lists?$select=id,displayName`,accessToken)
  const list = lists.value.find((x:{displayName:string})=>norm(x.displayName)==='comercialplaneacion')
  if (!list) throw new Error('No encontré la lista “Comercial planeacion”.')
  const columnsResponse = await graph(`/sites/${site.id}/lists/${list.id}/columns?$select=name,displayName`,accessToken)
  const drives = await graph(`/sites/${site.id}/drives?$select=id,name`,accessToken)
  const drive = drives.value.find((x:{name:string})=>norm(x.name)==='comercialplaneacionproyecto')
  if (!drive) throw new Error('No encontré la biblioteca “Comercial planeacion proyecto”.')
  const columns = new Map<string,string>(columnsResponse.value.map((x:{name:string;displayName:string})=>[norm(x.displayName),x.name]))
  context={siteId:site.id,listId:list.id,driveId:drive.id,columns}; return context
}

export async function signIn() { const accessToken=await token(true); if(!accessToken) throw new Error('No se pudo iniciar sesión con Microsoft.'); const profile=await graph('/me?$select=displayName,mail,userPrincipalName',accessToken); return {name:profile.displayName,email:profile.mail || profile.userPrincipalName} }
export async function signOut() { await msal.initialize(); const account=msal.getActiveAccount(); if(account) await msal.logoutPopup({account,postLogoutRedirectUri:redirectUri}) }

export async function loadTickets():Promise<Ticket[]> { const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.'); const c=await getContext(accessToken); const items=await graph(`/sites/${c.siteId}/lists/${c.listId}/items?expand=fields&top=999`,accessToken); return items.value.map((item:{id:string;createdDateTime:string;fields:Record<string,unknown>})=>({id:value(item.fields,c.columns,'ticket')||`DN-${item.id}`,spId:item.id,created_at:item.createdDateTime,requester_name:value(item.fields,c.columns,'name'),requester_email:value(item.fields,c.columns,'email'),country:value(item.fields,c.columns,'country'),study:value(item.fields,c.columns,'study'),request_type:value(item.fields,c.columns,'type'),detail:value(item.fields,c.columns,'detail'),status:(value(item.fields,c.columns,'status') || 'Pendiente') as Status,assignee:value(item.fields,c.columns,'assignee') as Analyst,attachment_name:value(item.fields,c.columns,'attachment')||undefined})).sort((a:Ticket,b:Ticket)=>b.created_at.localeCompare(a.created_at)) }

export async function createTicket(ticket:Ticket,file:File|null) { const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.'); const c=await getContext(accessToken); const fields:Record<string,unknown>={Title:ticket.id}; set(fields,c.columns,'ticket',ticket.id);set(fields,c.columns,'name',ticket.requester_name);set(fields,c.columns,'email',ticket.requester_email);set(fields,c.columns,'country',ticket.country);set(fields,c.columns,'study',ticket.study);set(fields,c.columns,'type',ticket.request_type);set(fields,c.columns,'detail',ticket.detail);set(fields,c.columns,'status',ticket.status);if(file)set(fields,c.columns,'attachment',file.name)
  const item=await graph(`/sites/${c.siteId}/lists/${c.listId}/items`,accessToken,{method:'POST',body:JSON.stringify({fields})})
  if(file){ try { await graph(`/drives/${c.driveId}/root/children`,accessToken,{method:'POST',body:JSON.stringify({name:ticket.id,folder:{},'@microsoft.graph.conflictBehavior':'replace'})}) } catch {} const response=await fetch(`https://graph.microsoft.com/v1.0/drives/${c.driveId}/root:/${encodeURIComponent(ticket.id)}/${encodeURIComponent(file.name)}:/content`,{method:'PUT',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':file.type||'application/octet-stream'},body:file}); if(!response.ok)throw new Error('El ticket se creó, pero no se pudo cargar el archivo.') }
  return {...ticket,spId:item.id}
}
export async function updateTicket(ticket:Ticket, patch:Partial<Ticket>) { const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.'); const c=await getContext(accessToken); const fields:Record<string,unknown>={};if(patch.status)set(fields,c.columns,'status',patch.status);if(patch.assignee!==undefined)set(fields,c.columns,'assignee',patch.assignee);await graph(`/sites/${c.siteId}/lists/${c.listId}/items/${ticket.spId}/fields`,accessToken,{method:'PATCH',body:JSON.stringify(fields)}) }
