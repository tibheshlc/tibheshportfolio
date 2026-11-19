const origins = new Set(['https://tibhesh.com','https://tibheshportfolio.pages.dev','https://tibheshlc.github.io']);
const MAX_BYTES = 16000;
export default {
 async fetch(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin'};
  if (origins.has(origin)) Object.assign(headers, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
  const reply = (status, data) => new Response(JSON.stringify(data),{status,headers});
  if (new URL(request.url).pathname !== '/api/contact') return reply(404,{error:'Not found.'});
  if (!origins.has(origin)) return reply(403,{error:'Please use the contact form on tibhesh.com.'});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return reply(405,{error:'Method not allowed.'});
  if (!request.headers.get('Content-Type')?.includes('application/json')) return reply(415,{error:'JSON required.'});
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply(413,{error:'Message is too long.'});
  let input;
  try {
   const reader = request.body?.getReader();
   if (!reader) return reply(400,{error:'Please enter your message.'});
   const chunks = []; let size = 0;
   while (true) {
    const {done,value} = await reader.read(); if(done) break;
    size += value.byteLength;
    if(size > MAX_BYTES) { await reader.cancel(); return reply(413,{error:'Message is too long.'}); }
    chunks.push(value);
   }
   const bytes = new Uint8Array(size); let offset=0;
   for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
   input = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return reply(400,{error:'Invalid form data.'}); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400,{error:'Invalid form data.'});
  if (input.website) return reply(200,{success:true});
  const field = key => typeof input[key] === 'string' ? input[key].trim() : '';
  const name=field('name'), email=field('email'), project=field('project'), message=field('message');
  if(!name || name.length>100 || /[\r\n]/.test(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || project.length>200 || !message || message.length>8000)
   return reply(400,{error:'Enter a valid name, email and message (up to 8,000 characters).'});
  try {
   const limit=await env.CONTACT_LIMIT.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'});
   if(!limit.success) return reply(429,{error:'Please wait a minute before sending another message.'});
   const text = 'New portfolio inquiry\n\nName: '+name+'\nEmail: '+email+'\nProject type: '+(project||'Not specified')+'\n\n'+message;
   const escape = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const sent=await env.EMAIL.send({from:{email:'contact@mail.tibhesh.com',name:'Tibhesh Portfolio'},to:'tibheshlc@gmail.com',replyTo:email,subject:'New portfolio inquiry',text,html:'<pre style="white-space:pre-wrap;font-family:sans-serif">'+escape(text)+'</pre>'});
   console.log(JSON.stringify({event:'contact_accepted',messageId:sent.messageId}));
   return reply(200,{success:true,messageId:sent.messageId});
  } catch(error) {
   console.error(JSON.stringify({event:'contact_failed',code:error.code || 'unknown'}));
   return reply(503,{error:'Could not send right now. Please try again or email tibheshlc@gmail.com.'});
  }
 }
};

