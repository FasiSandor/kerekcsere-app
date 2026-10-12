import {NextRequest,NextResponse} from "next/server";

const coreUrl=()=>process.env.CALENDAR_CORE_URL||"https://calendar-core.vercel.app";
const coreKey=()=>process.env.CALENDAR_CORE_API_KEY||"";

export async function POST(req:NextRequest){
  const key=coreKey();
  if(!key)return NextResponse.json({error:"core_not_configured"},{status:503});
  try{
    const body=await req.text();
    const r=await fetch(coreUrl()+"/api/events",{
      method:"POST",
      headers:{"content-type":"application/json","x-calendar-core-key":key},
      body,
      cache:"no-store"
    });
    const text=await r.text();
    return new NextResponse(text,{status:r.status,headers:{"content-type":r.headers.get("content-type")||"application/json"}});
  }catch{
    return NextResponse.json({error:"core_unreachable"},{status:502});
  }
}
