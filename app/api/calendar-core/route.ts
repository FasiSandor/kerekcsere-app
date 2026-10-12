import {NextRequest,NextResponse} from "next/server";

const CORE="https://calendar-core.vercel.app/api/source-events";

export async function POST(req:NextRequest){
  const key=process.env.CALENDAR_SOURCE_API_KEY||"";
  if(!key)return NextResponse.json({error:"not_configured"},{status:503});
  const body=await req.json().catch(()=>null);
  if(!body)return NextResponse.json({error:"invalid_body"},{status:400});
  const r=await fetch(CORE,{
    method:"POST",
    headers:{"content-type":"application/json","x-calendar-source-key":key},
    body:JSON.stringify(body),
    cache:"no-store"
  });
  const text=await r.text();
  return new NextResponse(text,{status:r.status,headers:{"content-type":r.headers.get("content-type")||"application/json"}});
}
