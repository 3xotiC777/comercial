import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as comments from "../src/ticketComments.ts";
import * as team from "../src/team.ts";
const compiled = ts.transpileModule(readFileSync(new URL('../src/commentApi.ts',import.meta.url),'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const uuid='0d926828-e787-4511-8bae-f3255326bc8d';
const ticket={spId:'99',requester_email:'forged@company.com',status:'Finalizado'};
function service({email='person@company.com',requester='person@company.com',pages=[{value:[]}],loseResponse=false,existing=null}={}) {
 const requests=[]; let saved=existing, page=0;
 const graph=async(path,token,options)=>{
  requests.push({path,options});
  if(path.startsWith('/me?'))return {displayName:'Persona',mail:email};
  if(path.includes('/lists/tickets/items/99?'))return {fields:{correo:requester}};
  if(path.endsWith('/lists?$select=id,displayName'))return {value:[{id:'comments',displayName:'Comentarios Comercial'}]};
  if(options?.method==='POST') {
   saved={id:'1',fields:JSON.parse(options.body).fields,createdDateTime:'2026-10-25T00:00:00Z'};
   if(loseResponse)throw Error('Network disconnected');
   return saved;
  }
  if(decodeURIComponent(path).includes('fields/Title eq'))return {value:saved?[saved]:[]};
  if(path.includes('/lists/comments/items?'))return pages[page++];
  throw Error('Unexpected '+path);
 };
 const exports={};
 new Function('require','exports',compiled)((name)=> name==='./sharepoint'?{graph,token:async()=> 'token',getContext:async()=>({siteId:'site',listId:'tickets'})}:name==='./team'?team:comments,exports);
 return {api:exports,requests};
}
test('rejects empty and oversized comments, preserves literal text safely',()=>{
 assert.throws(()=>comments.validateComment('  '));assert.throws(()=>comments.validateComment('x'.repeat(5001)));
 assert.equal(comments.validateComment(' <img src=x>\nHola & adiós '),'<img src=x>\nHola & adiós');
});
test('checks the persisted requester and rejects an impersonated origin',async()=>{
 const {api,requests}=service({email:'intruder@company.com'});
 await assert.rejects(api.addTicketComment(ticket,'Solicitante','Hola',uuid),/no puede participar/);
 await assert.rejects(api.addTicketComment(ticket,'Analista','Hola',uuid),/no puede participar/);
 await assert.rejects(api.addTicketComment(ticket,'Administrador','Hola',uuid),/origen/);
 assert.ok(requests.every(x=>!x.options));
});
test('a closed ticket accepts a comment without changing its fields or status',async()=>{
 const {api,requests}=service(); const result=await api.addTicketComment(ticket,'Solicitante','Hola',uuid);
 assert.equal(result.text,'Hola');assert.equal(result.author,'Persona');
 const writes=requests.filter(x=>x.options);assert.equal(writes.length,1);
 assert.equal(writes[0].path,'/sites/site/lists/comments/items');
 assert.deepEqual(JSON.parse(writes[0].options.body).fields,{Title:uuid,TicketId:'99',Comment:'Hola',Origin:'Solicitante'});
});
test('analysts can ask for information on another requester ticket',async()=>{
 const {api}=service({email:'DMONTOYA@DICHTER-NEIRA.COM'});
 assert.equal((await api.addTicketComment(ticket,'Analista','Confirma la fecha',uuid)).origin,'Analista');
});
test('a lost response and retry recover the same comment without another POST',async()=>{
 const {api,requests}=service({loseResponse:true});
 const a=await api.addTicketComment(ticket,'Solicitante','Hola',uuid);
 const b=await api.addTicketComment(ticket,'Solicitante','Hola',uuid);
 assert.equal(a.id,b.id);assert.equal(requests.filter(x=>x.options).length,1);
 await assert.rejects(api.addTicketComment(ticket,'Solicitante','Otro contenido',uuid),/otro contenido/);
});
test('loads all comment pages in chronological order and discards other tickets',async()=>{
 const item=(id,tid,date)=>({id,fields:{TicketId:tid,Comment:'Comentario'},createdDateTime:date});
 const {api}=service({pages:[{value:[item('2','99','2026-10-24'),item('3','88','2026-10-23')],'@odata.nextLink':'https://graph.microsoft.com/v1.0/sites/site/lists/comments/items?$skiptoken=x'}, {value:[item('1','99','2026-10-23')]}]});
 assert.deepEqual((await api.loadTicketComments(ticket,'Solicitante')).map(x=>x.id),['1','2']);
 const bad=service({pages:[{value:[],'@odata.nextLink':'https://example.com/leak'}]});
 await assert.rejects(bad.api.loadTicketComments(ticket,'Solicitante'),/página/);
});
