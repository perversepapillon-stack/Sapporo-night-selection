const OWNER = "perversepapillon-stack";
const REPO = "Sapporo-night-selection";
const PATH = "data/submissions.json";
const BRANCH = "main";

function json(res,status,data){res.statusCode=status;res.setHeader("content-type","application/json; charset=utf-8");res.end(JSON.stringify(data))}
function authAdmin(req){return !!process.env.ADMIN_KEY && req.headers["x-admin-key"]===process.env.ADMIN_KEY}
async function gh(path,opts={}){
 const token=process.env.GITHUB_DATA_TOKEN;
 if(!token) throw new Error("GITHUB_DATA_TOKEN is not configured");
 const r=await fetch("https://api.github.com"+path,{...opts,headers:{"accept":"application/vnd.github+json","authorization":"Bearer "+token,"x-github-api-version":"2022-11-28","user-agent":"sapporo-night-selection",...(opts.headers||{})}});
 if(!r.ok){const t=await r.text();const e=new Error(`GitHub ${r.status}: ${t}`);e.status=r.status;throw e}
 return r.json();
}
async function readAll(){
 try{
  const f=await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`);
  const txt=Buffer.from(f.content.replace(/\n/g,""),"base64").toString("utf8");
  return {items:JSON.parse(txt),sha:f.sha};
 }catch(e){if(e.status===404)return {items:[],sha:null};throw e}
}
async function writeAll(items,sha,message){
 const body={message,content:Buffer.from(JSON.stringify(items,null,2)).toString("base64"),branch:BRANCH};
 if(sha) body.sha=sha;
 return gh(`/repos/${OWNER}/${REPO}/contents/${PATH}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
}
export default async function handler(req,res){
 try{
  if(req.method==="POST"){
   const d=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
   if(!d.organization||!d.name||!["A","B","C"].includes(d.course)) return json(res,400,{error:"入力内容が不足しています"});
   const cur=await readAll();
   const item={id:crypto.randomUUID(),organization:String(d.organization).slice(0,120),name:String(d.name).slice(0,80),course:d.course,receiptRequired:!!d.receiptRequired,receiptName:d.receiptRequired?String(d.receiptName||"").slice(0,120):"",createdAt:new Date().toISOString()};
   cur.items.push(item);await writeAll(cur.items,cur.sha,`Add submission ${item.id}`);return json(res,201,{ok:true,id:item.id});
  }
  if(req.method==="GET"){
   if(!authAdmin(req)) return json(res,401,{error:"unauthorized"});
   const cur=await readAll();return json(res,200,cur.items.slice().reverse());
  }
  if(req.method==="DELETE"){
   if(!authAdmin(req)) return json(res,401,{error:"unauthorized"});
   const id=new URL(req.url,"http://localhost").searchParams.get("id");if(!id)return json(res,400,{error:"id required"});
   const cur=await readAll();const next=cur.items.filter(x=>x.id!==id);if(next.length===cur.items.length)return json(res,404,{error:"not found"});
   await writeAll(next,cur.sha,`Delete submission ${id}`);return json(res,200,{ok:true});
  }
  return json(res,405,{error:"method not allowed"});
 }catch(e){console.error(e);return json(res,500,{error:"server error"})}
}
