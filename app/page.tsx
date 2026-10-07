"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, ChevronRight, Home as HomeIcon, LocateFixed, MapPin, Settings, ShieldCheck, Snowflake, Sun, ThermometerSnowflake, Wrench } from "lucide-react";

type Tire = "summer" | "winter";
type WeatherDay = { date:string; max:number; min:number; code:number; snow:number; rain:number };
type Place = { name:string; lat:number; lon:number };

const PLACES: Place[] = [
  { name:"Törökszentmiklós", lat:47.1833, lon:20.4167 },
  { name:"Mezőtúr", lat:47.0, lon:20.6333 },
  { name:"Budapest", lat:47.4979, lon:19.0402 }
];

function icon(code:number){
  if ([71,73,75,77,85,86].includes(code)) return "❄️";
  if ([61,63,65,80,81,82].includes(code)) return "🌧️";
  if ([95,96,99].includes(code)) return "⛈️";
  if ([1,2].includes(code)) return "🌤️";
  if (code===3) return "☁️";
  return "☀️";
}

function analyze(days:WeatherDay[], tire:Tire){
  if(!days.length) return {level:"loading", title:"Előrejelzés betöltése", text:"Az időjárási adatok frissülnek.", eta:"—"};
  const d7=days.slice(0,7), d14=days.slice(0,14);
  const cold7=d7.filter(d=>(d.max+d.min)/2<=7).length;
  const frost=d14.findIndex(d=>d.min<=0);
  const snow=d14.findIndex(d=>d.snow>0 || [71,73,75,77,85,86].includes(d.code));
  const critical=[frost,snow].filter(i=>i>=0).sort((a,b)=>a-b)[0] ?? -1;
  const warm10=d14.slice(0,10).filter(d=>(d.max+d.min)/2>8).length;

  if(tire==="summer"){
    if(critical>=0 && critical<=7) return {level:"urgent", title:"Kerékcsere javasolt", text:"Fagy vagy havazás közeledhet. Érdemes most téli gumira időpontot foglalni.", eta:critical===0?"most":String(critical+1)+" napon belül"};
    if(cold7>=3 || (critical>=0 && critical<=13)) return {level:"warning", title:"Készülj a téli cserére", text:"A 7–14 napos trend már hidegebb időt mutat. A csere tervezése indokolt.", eta:critical>=0?String(critical+1)+" napon belül":"1–2 héten belül"};
    return {level:"ok", title:"Nyári gumi rendben", text:"A következő két hét alapján még nem sürgős a váltás.", eta:"nem sürgős"};
  }
  if(warm10>=8 && frost<0) return {level:"warning", title:"Nyári csere tervezhető", text:"Tartós melegedés látszik fagyveszély nélkül.", eta:"1–2 héten belül"};
  return {level:"ok", title:"Téli gumi megfelelő", text:"A hőmérsékleti trend alapján maradhat a téli garnitúra.", eta:"rendben"};
}

export default function Home(){
  const [tire,setTire]=useState<Tire>("summer");
  const [place,setPlace]=useState<Place>(PLACES[0]);
  const [days,setDays]=useState<WeatherDay[]>([]);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [notice,setNotice]=useState<string>("");

  useEffect(()=>{
    const t=localStorage.getItem("kerekcsere:tire") as Tire|null;
    if(t==="summer"||t==="winter") setTire(t);
    const p=localStorage.getItem("kerekcsere:place");
    if(p){ try{ setPlace(JSON.parse(p)); }catch{} }
  },[]);

  useEffect(()=>{
    const run=async()=>{
      try{
        const u=new URL("https://api.open-meteo.com/v1/forecast");
        u.searchParams.set("latitude",String(place.lat));
        u.searchParams.set("longitude",String(place.lon));
        u.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum");
        u.searchParams.set("forecast_days","14");
        u.searchParams.set("timezone","auto");
        const r=await fetch(u.toString(),{cache:"no-store"});
        const j=await r.json();
        const next:WeatherDay[]=j.daily.time.map((date:string,i:number)=>({date,max:Math.round(j.daily.temperature_2m_max[i]),min:Math.round(j.daily.temperature_2m_min[i]),code:j.daily.weather_code[i],snow:j.daily.snowfall_sum[i]||0,rain:j.daily.precipitation_probability_max[i]||0}));
        setDays(next);
      }catch{ setDays([]); }
    };
    run();
  },[place]);

  const result=useMemo(()=>analyze(days,tire),[days,tire]);
  const current=days[0];

  function saveTire(v:Tire){ setTire(v); localStorage.setItem("kerekcsere:tire",v); }
  function savePlace(v:Place){ setPlace(v); localStorage.setItem("kerekcsere:place",JSON.stringify(v)); }

  function useLocation(){
    if(!navigator.geolocation){ setNotice("A helymeghatározás nem támogatott."); return; }
    navigator.geolocation.getCurrentPosition(p=>{
      savePlace({name:"Aktuális hely",lat:p.coords.latitude,lon:p.coords.longitude});
      setNotice("GPS hely használatban");
    },()=>setNotice("A helyhozzáférés nincs engedélyezve."));
  }

  async function notify(){
    if(!("Notification" in window)){ setNotice("Ez a böngésző nem támogatja az értesítést."); return; }
    const p=await Notification.requestPermission();
    setNotice(p==="granted"?"Értesítés engedélyezve":"Értesítés nincs engedélyezve");
  }

  return <main className="app">
    <header className="top">
      <div className="brand"><div className="logo">◉</div><div><h1>KERÉK<span>CSERE</span></h1><p>BIZTONSÁGBAN MINDIG TOVÁBB</p></div></div>
      <button className="weather" onClick={()=>setSettingsOpen(true)}><MapPin size={18}/><div><small>{place.name}</small><strong>{current?String(current.max)+"°":"—"}</strong></div><b>{current?icon(current.code):"…"}</b></button>
    </header>

    <section className="hero">
      <img src="/ford-family-hero.jpg" alt="Ford Focus családi kép"/>
      <div className="shade"></div>
      <div className="heroText"><small>FORD FOCUS · LZE-585</small><h2>BIZTONSÁG<br/>MINDEN <span>ÉVSZAKBAN</span></h2><p>A megfelelő gumi több, mint kényelem.<br/>Ez a biztonságotok.</p></div>
    </section>

    <section className="wheelCard">
      <div><h3>A JÓ TAPADÁS<br/>NEM VÁRAT MAGÁRA</h3><p>Felkészülve bármi jöhet.</p></div>
      <div className="fakeWheel"><span>✦</span></div>
      <ul><li>❄️ Biztosabb tapadás</li><li>🛡️ Rövidebb fékút</li><li>🛣️ Jobb irányíthatóság</li></ul>
    </section>

    <section className="status">
      <div className={"statusIcon "+tire}>{tire==="summer"?<Sun/>:<Snowflake/>}</div>
      <div><h3>{tire==="summer"?"Nyári gumi aktív":"Téli gumi aktív"}</h3><p>{result.title} · <b>{result.eta}</b></p></div>
      <button onClick={()=>setSettingsOpen(true)}>Gumi állapota <ChevronRight size={16}/></button>
    </section>

    <section className="forecast">
      <div className="sectionHead"><div><ThermometerSnowflake size={20}/><h3>Időjárás előrejelzés <span>(14 nap)</span></h3></div><em className={String(result.level)}>{result.level==="urgent"?<AlertTriangle size={14}/>:<Check size={14}/>} {result.level==="urgent"?"Figyelmeztetés":result.level==="warning"?"Készülj":"Rendben"}</em></div>
      <div className="days">{days.length?days.map((d,i)=><div className="day" key={d.date}><small>{i===0?"Ma":new Intl.DateTimeFormat("hu-HU",{weekday:"short"}).format(new Date(d.date+"T12:00:00")).replace(".","")}</small><span>{icon(d.code)}</span><b>{d.max}°</b><i>{d.min}°</i></div>):<p>Friss adatok betöltése…</p>}</div>
    </section>

    <section className={"recommend "+result.level}>
      <div className="recIcon">{result.level==="urgent"||result.level==="warning"?<Snowflake/>:<ShieldCheck/>}</div>
      <div><small>INTELLIGENS FIGYELÉS</small><h2>{result.title}</h2><p>{result.text}</p></div><ChevronRight/>
    </section>

    <section className="actions">
      <button className="primary" onClick={()=>saveTire(tire==="summer"?"winter":"summer")}><Check size={18}/> Már lecseréltem</button>
      <button onClick={notify}><Bell size={18}/> Értesítések</button>
      <button onClick={()=>setSettingsOpen(true)}><Settings size={18}/> Beállítások</button>
    </section>

    {notice&&<div className="notice">{notice}</div>}

    <nav><button className="active"><HomeIcon/><span>Főoldal</span></button><button><ThermometerSnowflake/><span>Előrejelzés</span></button><button><Wrench/><span>Szerviz</span></button><button onClick={()=>setSettingsOpen(true)}><Settings/><span>Profil</span></button></nav>

    {settingsOpen&&<div className="backdrop" onClick={()=>setSettingsOpen(false)}><div className="sheet" onClick={e=>e.stopPropagation()}>
      <div className="handle"></div><div className="sheetTitle"><div><small>BEÁLLÍTÁSOK</small><h2>Kerékcsere figyelő</h2></div><button onClick={()=>setSettingsOpen(false)}>×</button></div>
      <label>Jelenlegi gumi</label><div className="seg"><button className={tire==="summer"?"sel":""} onClick={()=>saveTire("summer")}><Sun size={16}/> Nyári</button><button className={tire==="winter"?"sel":""} onClick={()=>saveTire("winter")}><Snowflake size={16}/> Téli</button></div>
      <label>Figyelt hely</label><div className="places">{PLACES.map(p=><button key={p.name} className={place.name===p.name?"sel":""} onClick={()=>savePlace(p)}><MapPin size={16}/>{p.name}{place.name===p.name&&<Check size={16}/>}</button>)}<button onClick={useLocation}><LocateFixed size={16}/>Aktuális hely használata</button></div>
      <label>Értesítés</label><button className="wide" onClick={notify}><Bell size={17}/> Értesítések engedélyezése</button>
      <p className="hint">A teljes háttérben futó napi push figyeléshez a következő körben szerveroldali ütemezést kötünk be.</p>
    </div></div>}
  </main>;
}
