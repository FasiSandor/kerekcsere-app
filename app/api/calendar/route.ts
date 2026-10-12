import {NextRequest,NextResponse} from "next/server";

const coreUrl=()=>process.env.CALENDAR_CORE_URL||"https://calendar-core.vercel.app";
const sourceKey=()=>process.env.CALENDAR_SOURCE_API_KEY||"";

type Item={key:string;title:string;date:string;note?:string};

export async function POST(req:NextRequest){
  const key=sourceKey();
  if(!key)return NextResponse.json({ok:false,error:"calendar_not_configured"},{status:503});
  const body=await req.json().catch(()=>({}));
  const items=Array.isArray(body.items)?body.items as Item[]:[];
  const linkedUrl="https://kerekcsere-app.vercel.app/?tab=garage";
  const results:any[]=[];

  for(const item of items){
    const sourceRecordId="ford-focus-lze585:"+String(item.key||"");
    const payload=item.date?{
      title:String(item.title||"Autós határidő"),
      date:String(item.date).slice(0,10),
      allDay:true,
      timezone:"Europe/Budapest",
      category:"personal",
      location:"",
      note:String(item.note||""),
      sourceApp:"kerekcsere-app",
      sourceRecordId,
      sourceUrl:linkedUrl,
      metadata:{
        linkedApp:"kerekcsere-app",
        linkedLabel:"Kerékcsere · Szerviz / Határidők",
        linkedUrl,
        vehicle:"Ford Focus · LZE-585",
        deadlineKey:item.key
      }
    }:{
      deleted:true,
      sourceApp:"kerekcsere-app",
      sourceRecordId
    };

    try{
      const r=await fetch(coreUrl()+"/api/source-events",{
        method:"POST",
        headers:{"content-type":"application/json","x-calendar-source-key":key},
        body:JSON.stringify(payload),
        cache:"no-store"
      });
      results.push({key:item.key,ok:r.ok,status:r.status});
    }catch{
      results.push({key:item.key,ok:false,status:0});
    }
  }

  return NextResponse.json({ok:results.every(x=>x.ok),results});
}
