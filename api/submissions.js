export default async function handler(req,res){
  res.statusCode=503;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.end(JSON.stringify({error:"申込データ用の非公開ストレージ設定中です"}));
}
