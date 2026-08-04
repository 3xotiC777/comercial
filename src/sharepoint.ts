import { PublicClientApplication } from '@azure/msal-browser'

export type Status = 'Pendiente' | 'En proceso' | 'Finalizado'
export type Analyst = 'Diego' | 'Miguel' | 'Rony' | ''
export type Ticket = { id:string; spId:string; created_at:string; requester_name:string; requester_email:string; country:string; study:string; request_type:string; detail:string; status:Status; assignee:Analyst; attachment_name?:string; resolution?:string; resolution_files?:string[]; completed_at?:string }

const tenantId = '05e4f087-3719-4046-8fa3-286b1f5110f2'
const clientId = '373c64ec-c8ef-41bf-a2e9-bb2225bceb9a'
const scopes = ['User.Read', 'Sites.ReadWrite.All']
const redirectUri = window.location.hostname.endsWith('github.io') ? `${window.location.origin}/comercial/auth.html` : `${window.location.origin}/auth.html`
const msal = new PublicClientApplication({ auth:{ clientId, authority:`https://login.microsoftonline.com/${tenantId}`, redirectUri }, cache:{cacheLocation:'sessionStorage'} })

const norm = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const aliases:Record<string,string[]> = {
  ticket: ['Título','Titulo','Title','Ticket','Id de ticket','Ticket id','Id ticket'],
  name: ['Solicitante','Nombre solicitante','Nombre completo','Nombre'],
  email: ['Correo','Correo solicitante','Correo corporativo','Email'],
  country: ['Pais','País'], study: ['Estudio'], type: ['Tipo de solicitud','Tipo'],
  detail: ['Detalle','Detalle de solicitud','Solicitud'], status: ['Estado'],
  assignee: ['Responsable','Analista'], attachment: ['Archivo','Adjunto','Insumo'],
  resolution: ['Solución','Solucion','Respuesta','Respuesta final','Detalle de solución'],
  resolutionFiles: ['Archivos solución','Archivos de solución','Adjuntos solución','Adjuntos de solución'],
  completedAt: ['Fecha finalización','Fecha de finalización','Fecha cierre','Fecha de cierre'],
}
const fallbackFields:Record<string,string> = {ticket:'Title',status:'estado',assignee:'responsable'}
let context: {siteId:string;listId:string;driveId:string;columns:Map<string,string>} | null = null

async function token(interactive=false) {
  await msal.initialize()
  let account = msal.getActiveAccount() || msal.getAllAccounts()[0]
  if (!account && interactive) account = (await msal.loginPopup({scopes,overrideInteractionInProgress:true})).account || undefined
  if (!account) return null
  msal.setActiveAccount(account)
  try { return (await msal.acquireTokenSilent({scopes,account,forceRefresh:true})).accessToken }
  catch { return interactive ? (await msal.acquireTokenPopup({scopes,account,overrideInteractionInProgress:true})).accessToken : null }
}
async function graph(path:string, accessToken:string, init:RequestInit={}) {
  const headers = new Headers(init.headers); headers.set('Authorization',`Bearer ${accessToken}`); headers.set('Content-Type','application/json')
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`,{...init,headers})
  if (!response.ok) {
    let detail = ''
    try { const body = await response.clone().json(); detail = body?.error?.message || '' } catch { detail = await response.text() }
    const resource = path.startsWith('/me') ? 'perfil de Microsoft' : path.includes('/drives') ? 'biblioteca de archivos' : path.includes('/lists') ? 'lista Comercial planeacion' : 'sitio reportingdn'
    throw new Error(`Microsoft Graph respondió ${response.status} al acceder a ${resource}.${detail ? ` ${detail}` : ''}`)
  }
  return response.status === 204 ? null : response.json()
}
function field(columns:Map<string,string>, key:string) { return aliases[key].map(x=>columns.get(norm(x))).find(Boolean) || fallbackFields[key] }
function value(fields:Record<string,unknown>, columns:Map<string,string>, key:string) { const name=field(columns,key); return name ? String(fields[name] ?? '') : '' }
function set(fields:Record<string,unknown>, columns:Map<string,string>, key:string, data:unknown) { const name=field(columns,key); if(name) fields[name]=data }

async function getContext(accessToken:string) {
  if (context) return context
  const site = await graph('/sites/dichterneiracorp.sharepoint.com:/sites/reportingdn',accessToken)
  const lists = await graph(`/sites/${site.id}/lists?$select=id,displayName`,accessToken)
  const list = lists.value.find((x:{displayName:string})=>norm(x.displayName)==='comercialplaneacion')
  if (!list) throw new Error('No encontré la lista “Comercial planeacion”.')
  const columnsResponse = await graph(`/sites/${site.id}/lists/${list.id}/columns?$select=name,displayName,readOnly,hidden`,accessToken)
  const drives = await graph(`/sites/${site.id}/drives?$select=id,name`,accessToken)
  const drive = drives.value.find((x:{name:string})=>norm(x.name)==='comercialplaneacionproyecto')
  if (!drive) throw new Error('No encontré la biblioteca “Comercial planeacion proyecto”.')
  const writableColumns = columnsResponse.value.filter((x:{name:string;readOnly?:boolean;hidden?:boolean})=>!x.readOnly&&!x.hidden&&x.name!=='DocIcon')
  const columns = new Map<string,string>(writableColumns.map((x:{name:string;displayName:string})=>[norm(x.displayName),x.name]))
  context={siteId:site.id,listId:list.id,driveId:drive.id,columns}; return context
}

export async function signIn() { const accessToken=await token(true); if(!accessToken) throw new Error('No se pudo iniciar sesión con Microsoft.'); const profile=await graph('/me?$select=displayName,mail,userPrincipalName',accessToken); return {name:profile.displayName,email:profile.mail || profile.userPrincipalName} }
export async function signOut() { await msal.initialize(); const account=msal.getActiveAccount(); if(account) await msal.logoutPopup({account,postLogoutRedirectUri:redirectUri}) }

export async function loadTickets():Promise<Ticket[]> { const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.'); const c=await getContext(accessToken); const items=await graph(`/sites/${c.siteId}/lists/${c.listId}/items?expand=fields&top=999`,accessToken); return items.value.map((item:{id:string;createdDateTime:string;fields:Record<string,unknown>})=>{const resolutionFiles=value(item.fields,c.columns,'resolutionFiles');return {id:value(item.fields,c.columns,'ticket')||`DN-${item.id}`,spId:item.id,created_at:item.createdDateTime,requester_name:value(item.fields,c.columns,'name'),requester_email:value(item.fields,c.columns,'email'),country:value(item.fields,c.columns,'country'),study:value(item.fields,c.columns,'study'),request_type:value(item.fields,c.columns,'type'),detail:value(item.fields,c.columns,'detail'),status:(value(item.fields,c.columns,'status') || 'Pendiente') as Status,assignee:value(item.fields,c.columns,'assignee') as Analyst,attachment_name:value(item.fields,c.columns,'attachment')||undefined,resolution:value(item.fields,c.columns,'resolution')||undefined,resolution_files:resolutionFiles?resolutionFiles.split('; ').filter(Boolean):undefined,completed_at:value(item.fields,c.columns,'completedAt')||undefined}}).sort((a:Ticket,b:Ticket)=>b.created_at.localeCompare(a.created_at)) }

export async function createTicket(ticket:Ticket,file:File|null) { const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.'); const c=await getContext(accessToken); const fields:Record<string,unknown>={Title:ticket.id}; set(fields,c.columns,'ticket',ticket.id);set(fields,c.columns,'name',ticket.requester_name);set(fields,c.columns,'email',ticket.requester_email);set(fields,c.columns,'country',ticket.country);set(fields,c.columns,'study',ticket.study);set(fields,c.columns,'type',ticket.request_type);set(fields,c.columns,'detail',ticket.detail);set(fields,c.columns,'status',ticket.status);if(file)set(fields,c.columns,'attachment',file.name)
  const item=await graph(`/sites/${c.siteId}/lists/${c.listId}/items`,accessToken,{method:'POST',body:JSON.stringify({fields})})
  if(file){ try { await graph(`/drives/${c.driveId}/root/children`,accessToken,{method:'POST',body:JSON.stringify({name:ticket.id,folder:{},'@microsoft.graph.conflictBehavior':'replace'})}) } catch {} const response=await fetch(`https://graph.microsoft.com/v1.0/drives/${c.driveId}/root:/${encodeURIComponent(ticket.id)}/${encodeURIComponent(file.name)}:/content`,{method:'PUT',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':file.type||'application/octet-stream'},body:file}); if(!response.ok)throw new Error('El ticket se creó, pero no se pudo cargar el archivo.') }
  return {...ticket,spId:item.id}
}
export async function updateTicket(ticket:Ticket, patch:Partial<Ticket>) {
  const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.')
  const c=await getContext(accessToken), fields:Record<string,unknown>={}
  const statusField=field(c.columns,'status'), assigneeField=field(c.columns,'assignee')
  if(patch.status&&statusField)fields[statusField]=patch.status
  if(patch.assignee!==undefined&&assigneeField)fields[assigneeField]=patch.assignee
  const updated=await graph(`/sites/${c.siteId}/lists/${c.listId}/items/${ticket.spId}/fields`,accessToken,{method:'PATCH',body:JSON.stringify(fields)})
  if(patch.status&&statusField&&String(updated?.[statusField]??'')!==patch.status)throw new Error('SharePoint no confirmó el cambio de estado.')
  if(patch.assignee!==undefined&&assigneeField&&String(updated?.[assigneeField]??'')!==patch.assignee)throw new Error('SharePoint no confirmó el cambio de responsable.')
}

async function ensureFolder(accessToken:string, driveId:string, parentPath:string, name:string) {
  const path=[parentPath,name].filter(Boolean).map(part=>encodeURIComponent(part)).join('/'), endpoint=parentPath ? `/drives/${driveId}/root:/${encodeURIComponent(parentPath)}:/children` : `/drives/${driveId}/root/children`
  try { await graph(`/drives/${driveId}/root:/${path}`,accessToken);return } catch (error) { if(!(error instanceof Error)||!error.message.includes('respondió 404'))throw error }
  await graph(endpoint,accessToken,{method:'POST',body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})})
}

async function uploadSolutionFile(accessToken:string, driveId:string, ticketId:string, file:File) {
  const response=await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURIComponent(ticketId)}/Solucion/${encodeURIComponent(file.name)}:/content`,{method:'PUT',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':file.type||'application/octet-stream'},body:file})
  if(!response.ok){let detail='';try{const body=await response.json();detail=body?.error?.message||''}catch{}throw new Error(`No se pudo cargar “${file.name}”.${detail?` ${detail}`:''}`)}
}

export async function finalizeTicket(ticket:Ticket, resolution:string, files:File[]) {
  const accessToken=await token(true); if(!accessToken) throw new Error('Debes iniciar sesión con Microsoft.')
  const c=await getContext(accessToken)
  const statusField=field(c.columns,'status'), resolutionField=field(c.columns,'resolution')
  if(!resolutionField) throw new Error('Falta la columna “Solución” en la lista Comercial planeacion. Créala como “Varias líneas de texto” y vuelve a intentarlo.')

  if(files.length){await ensureFolder(accessToken,c.driveId,'',ticket.id);await ensureFolder(accessToken,c.driveId,ticket.id,'Solucion');for(const file of files)await uploadSolutionFile(accessToken,c.driveId,ticket.id,file)}

  const completedAt=new Date().toISOString(), fields:Record<string,unknown>={}
  fields[resolutionField]=resolution
  if(statusField)fields[statusField]='Finalizado'
  const filesField=field(c.columns,'resolutionFiles'), completedAtField=field(c.columns,'completedAt')
  if(filesField)fields[filesField]=files.map(file=>file.name).join('; ')
  if(completedAtField)fields[completedAtField]=completedAt
  const updated=await graph(`/sites/${c.siteId}/lists/${c.listId}/items/${ticket.spId}/fields`,accessToken,{method:'PATCH',body:JSON.stringify(fields)})
  if(statusField&&String(updated?.[statusField]??'')!=='Finalizado')throw new Error('SharePoint no confirmó el cierre del ticket.')
  if(String(updated?.[resolutionField]??'')!==resolution)throw new Error('SharePoint no confirmó el texto de la solución.')
  return {status:'Finalizado' as Status,resolution,resolution_files:files.map(file=>file.name),completed_at:completedAt}
}
