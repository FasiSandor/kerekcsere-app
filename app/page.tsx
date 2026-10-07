"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BatteryCharging, Bell, CalendarDays, Car, Check, ChevronRight,
  CircleGauge, ClipboardList, Gauge, Home as HomeIcon, LocateFixed, MapPin,
  Plus, Settings, ShieldCheck, Snowflake, Sun, ThermometerSnowflake, Trash2,
  Wrench
} from "lucide-react";

type Tire = "summer" | "winter";
type Tab = "home" | "forecast" | "garage" | "profile";
type WeatherDay = { date:string; max:number; min:number; code:number; snow:number; rain:number };
type Place = { name:string; lat:number; lon:number };
type TireInfo = { profile:number; dot:string; seasons:number; km:number };
type CarState = {
  mileage:number; battery:number; currentTire:Tire;
  summer:TireInfo; winter:TireInfo;
  technical:string; insurance:string; vignette:string;
  oilDate:string; oilKm:number; oilInterval:number;
  brakeFluid:string; timingDate:string; timingKm:number; timingInterval:number;
};
type ServiceEntry = { id:string; date:string; title:string; mileage:number; note:string };
type Diagnostic = { id:string; date:string; codes:string[]; note:string; resolved:boolean; severity?:"low"|"medium"|"high"; summary?:string; advice?:string };

const PLACES: Place[] = [
  { name:"Törökszentmiklós", lat:47.1833, lon:20.4167 },
  { name:"Mezőtúr", lat:47.0, lon:20.6333 },
  { name:"Budapest", lat:47.4979, lon:19.0402 }
];

const DEFAULT_CAR:CarState = {
  mileage:0, battery:12.5, currentTire:"summer",
  summer:{profile:6,dot:"",seasons:0,km:0},
  winter:{profile:7,dot:"",seasons:0,km:0},
  technical:"", insurance:"", vignette:"",
  oilDate:"", oilKm:0, oilInterval:10000,
  brakeFluid:"", timingDate:"", timingKm:0, timingInterval:60000
};

function icon(code:number){
  if ([71,73,75,77,85,86].includes(code)) return "❄️";
  if ([61,63,65,80,81,82].includes(code)) return "🌧️";
  if ([95,96,99].includes(code)) return "⛈️";
  if ([1,2].includes(code)) return "🌤️";
  if (code===3) return "☁️";
  if ([45,48].includes(code)) return "🌫️";
  return "☀️";
}
function dayName(date:string){
  return new Intl.DateTimeFormat("hu-HU",{weekday:"short"}).format(new Date(date+"T12:00:00")).replace(".","");
}
function daysUntil(date:string){
  if(!date) return null;
  const d=new Date(date+"T12:00:00").getTime();
  const now=new Date(); now.setHours(12,0,0,0);
  return Math.ceil((d-now.getTime())/86400000);
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
function explainCodes(codes:string[]){
  const known:Record<string,{summary:string;severity:"low"|"medium"|"high";advice:string}> = {
    P0420:{summary:"Katalizátor hatásfok a küszöb alatt (Bank 1)",severity:"medium",advice:"Érdemes lambda-szonda, kipufogó-szivárgás és katalizátor irányban diagnosztizálni. Ne csak töröld a kódot."},
    P0430:{summary:"Katalizátor hatásfok a küszöb alatt (Bank 2)",severity:"medium",advice:"Katalizátor/lambda-szonda és kipufogórendszer ellenőrzése javasolt."},
    P0171:{summary:"Túl szegény keverék (Bank 1)",severity:"medium",advice:"Levegőszivárgás, MAF, üzemanyag-ellátás és keverékszabályzás ellenőrzése javasolt."},
    P0172:{summary:"Túl dús keverék (Bank 1)",severity:"medium",advice:"MAF, injektorok, üzemanyagnyomás és lambda-szabályzás ellenőrzése javasolt."},
    P0299:{summary:"Turbónyomás túl alacsony",severity:"medium",advice:"Töltőlevegő-csövek, vákuum/aktuátor, turbó és nyomásszabályzás ellenőrzése javasolt."},
    P0234:{summary:"Turbónyomás túl magas",severity:"high",advice:"Kerüld a nagy terhelést, amíg a töltőnyomás-szabályzás nincs ellenőrizve."},
    P0401:{summary:"EGR-áramlás elégtelen",severity:"medium",advice:"EGR-szelep, járatok és vezérlés ellenőrzése/tisztítása javasolt."},
    P0402:{summary:"EGR-áramlás túl nagy",severity:"medium",advice:"EGR-szelep és vezérlés ellenőrzése javasolt."},
    P0101:{summary:"MAF jel tartomány/teljesítmény hiba",severity:"medium",advice:"Légszűrőház, csatlakozók, fals levegő és MAF ellenőrzése javasolt."},
    P0562:{summary:"Rendszerfeszültség túl alacsony",severity:"high",advice:"Akkumulátor, generátor és töltőrendszer ellenőrzése javasolt, különösen hideg idő előtt."},
    P0563:{summary:"Rendszerfeszültség túl magas",severity:"high",advice:"Töltésszabályzás/generátor ellenőrzése mielőbb javasolt."},
    P0606:{summary:"Motorvezérlő processzorhiba",severity:"high",advice:"Ne hagyd figyelmen kívül; szakműhelyes diagnosztika indokolt."},
    P0700:{summary:"Váltóvezérlő hibát jelzett",severity:"high",advice:"A váltóvezérlő saját hibakódjait is ki kell olvasni."},
    U0100:{summary:"Kommunikáció megszakadt a motorvezérlővel",severity:"high",advice:"Tápellátás, CAN-hálózat, csatlakozók és vezérlők ellenőrzése javasolt."},
    U0121:{summary:"Kommunikáció megszakadt az ABS vezérlővel",severity:"high",advice:"ABS/CAN tápellátás és kommunikáció ellenőrzése javasolt."}
  };
  if(!codes.length) return {severity:"low" as const,summary:"Riport mentve, szabványos OBD-kód nem azonosítható.",advice:"A Carly szöveget megőriztük. Ha van külön hibakód-lista, másold be azt is."};
  let severity:"low"|"medium"|"high"="low";
  const summaries:string[]=[];
  const advice:string[]=[];
  for(const code of codes){
    if(/^P03\d\d$/.test(code)){
      summaries.push(code+": Gyújtáskimaradás / égéskimaradás");
      severity="high";
      advice.push("Ha rángat vagy villog a motorhiba-lámpa, kerüld a nagy terhelést és vizsgáltasd át.");
      continue;
    }
    const k=known[code];
    if(k){
      summaries.push(code+": "+k.summary);
      if(k.severity==="high" || (k.severity==="medium"&&severity==="low")) severity=k.severity;
      advice.push(k.advice);
      continue;
    }
    if(code.startsWith("P")) summaries.push(code+": hajtáslánc / motor-váltó jellegű OBD-kód");
    else if(code.startsWith("B")) summaries.push(code+": karosszéria/komfort rendszer kód");
    else if(code.startsWith("C")) summaries.push(code+": futómű/ABS rendszer kód");
    else if(code.startsWith("U")){summaries.push(code+": kommunikációs/hálózati kód"); if(severity==="low") severity="medium";}
  }
  if(!advice.length) advice.push("A pontos jelentés típus- és vezérlőfüggő lehet; a Carly részletes leírásával együtt értékeld.");
  return {severity,summary:summaries.join(" · "),advice:Array.from(new Set(advice)).join(" ")};
}
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

export default function App(){
  const [tab,setTab]=useState<Tab>("home");
  const [place,setPlace]=useState<Place>(PLACES[0]);
  const [days,setDays]=useState<WeatherDay[]>([]);
  const [car,setCar]=useState<CarState>(DEFAULT_CAR);
  const [services,setServices]=useState<ServiceEntry[]>([]);
  const [diagnostics,setDiagnostics]=useState<Diagnostic[]>([]);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [notice,setNotice]=useState("");
  const [serviceForm,setServiceForm]=useState({date:new Date().toISOString().slice(0,10),title:"",mileage:"",note:""});
  const [carlyText,setCarlyText]=useState("");
  const tire=car.currentTire;

  useEffect(()=>{
    const p=localStorage.getItem("kerekcsere:place");
    const c=localStorage.getItem("kerekcsere:car");
    const s=localStorage.getItem("kerekcsere:services");
    const d=localStorage.getItem("kerekcsere:diagnostics");
    if(p){try{setPlace(JSON.parse(p))}catch{}}
    if(c){try{setCar({...DEFAULT_CAR,...JSON.parse(c)})}catch{}}
    if(s){try{setServices(JSON.parse(s))}catch{}}
    if(d){try{setDiagnostics(JSON.parse(d))}catch{}}
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
  },[]);

  useEffect(()=>{ localStorage.setItem("kerekcsere:car",JSON.stringify(car)); },[car]);
  useEffect(()=>{ localStorage.setItem("kerekcsere:services",JSON.stringify(services)); },[services]);
  useEffect(()=>{ localStorage.setItem("kerekcsere:diagnostics",JSON.stringify(diagnostics)); },[diagnostics]);

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
        if(!r.ok) throw new Error("weather");
        const j=await r.json();
        setDays(j.daily.time.map((date:string,i:number)=>({
          date,max:Math.round(j.daily.temperature_2m_max[i]),min:Math.round(j.daily.temperature_2m_min[i]),
          code:j.daily.weather_code[i],snow:j.daily.snowfall_sum[i]||0,rain:j.daily.precipitation_probability_max[i]||0
        })));
      }catch{ setDays([]); }
    };
    run();
  },[place]);

  const result=useMemo(()=>analyze(days,tire),[days,tire]);
  const current=days[0];
  const activeTire=tire==="summer"?car.summer:car.winter;

  const health=useMemo(()=>{
    let score=100;
    if(car.battery<12.2) score-=18; else if(car.battery<12.4) score-=8;
    if(activeTire.profile<3) score-=25; else if(activeTire.profile<4) score-=12;
    const due=[car.technical,car.insurance,car.vignette].map(daysUntil).filter(v=>v!==null) as number[];
    score-=due.filter(v=>v<0).length*15;
    score-=due.filter(v=>v>=0&&v<=30).length*6;
    const oilDue=car.oilKm>0 && car.mileage>=car.oilKm+car.oilInterval;
    if(oilDue) score-=12;
    score-=diagnostics.filter(x=>!x.resolved).length*8;
    return Math.max(0,Math.min(100,score));
  },[car,activeTire.profile,diagnostics]);

  const upcoming=useMemo(()=>{
    const items=[
      {label:"Műszaki vizsga",date:car.technical},
      {label:"Biztosítás",date:car.insurance},
      {label:"Autópálya matrica",date:car.vignette},
      {label:"Fékfolyadék",date:car.brakeFluid},
      {label:"Vezérlés",date:car.timingDate}
    ].filter(x=>x.date).map(x=>({...x,days:daysUntil(x.date)!})).sort((a,b)=>a.days-b.days);
    return items;
  },[car]);

  function savePlace(v:Place){ setPlace(v); localStorage.setItem("kerekcsere:place",JSON.stringify(v)); }
  function switchTire(v:Tire){
    setCar(c=>({...c,currentTire:v}));
    setNotice(v==="winter"?"Téli gumi beállítva":"Nyári gumi beállítva");
  }
  function useLocation(){
    if(!navigator.geolocation){setNotice("A helymeghatározás nem támogatott.");return;}
    navigator.geolocation.getCurrentPosition(p=>{savePlace({name:"Aktuális hely",lat:p.coords.latitude,lon:p.coords.longitude});setNotice("GPS hely használatban");},()=>setNotice("A helyhozzáférés nincs engedélyezve."));
  }
  async function notify(){
    if(!("Notification" in window)){setNotice("Ez a böngésző nem támogatja az értesítést.");return;}
    const p=await Notification.requestPermission();
    setNotice(p==="granted"?"Értesítések engedélyezve":"Értesítések nincsenek engedélyezve");
  }
  function addService(){
    if(!serviceForm.title.trim()) return;
    setServices(s=>[{id:uid(),date:serviceForm.date,title:serviceForm.title.trim(),mileage:Number(serviceForm.mileage)||car.mileage,note:serviceForm.note.trim()},...s]);
    setServiceForm({date:new Date().toISOString().slice(0,10),title:"",mileage:"",note:""});
    setNotice("Szervizbejegyzés elmentve");
  }
  function importCarly(){
    const codes=Array.from(new Set((carlyText.toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g)||[])));
    if(!carlyText.trim()) return;
    const explanation=explainCodes(codes);
    setDiagnostics(d=>[{id:uid(),date:new Date().toISOString().slice(0,10),codes,note:carlyText.trim().slice(0,900),resolved:false,...explanation},...d]);
    setCarlyText("");
    setNotice(codes.length?codes.length+" Carly hibakód elemezve és elmentve":"Carly riport elmentve");
  }

  const HomeView=()=> <div className="view">
    <section className="hero">
      <img src="/ford-family-hero.jpg" alt="Ford Focus családi kép"/>
      <div className="shade"/>
      <div className="heroText"><small>FORD FOCUS · LZE-585</small><h2>BIZTONSÁG<br/>MINDEN <span>ÉVSZAKBAN</span></h2><p>A megfelelő gumi több, mint kényelem.<br/>Ez a biztonságotok.</p></div>
    </section>

    <section className="healthGrid">
      <article className="healthCard">
        <div className={"score "+(health<70?"bad":health<85?"mid":"good")}>{health}</div>
        <div><small>AUTÓ EGÉSZSÉG</small><h3>{health>=85?"Minden rendben":health>=70?"Érdemes ránézni":"Figyelmet kér"}</h3><p>Gumi, akku, határidők és Carly hibák alapján.</p></div>
      </article>
      <article className="miniCard"><BatteryCharging/><div><small>Akkumulátor</small><b>{car.battery.toFixed(1)} V</b><span>{car.battery>=12.4?"rendben":car.battery>=12.2?"gyengül":"ellenőrizd"}</span></div></article>
    </section>

    <section className="status">
      <div className={"statusIcon "+tire}>{tire==="summer"?<Sun/>:<Snowflake/>}</div>
      <div><h3>{tire==="summer"?"Nyári gumi aktív":"Téli gumi aktív"}</h3><p>{result.title} · <b>{result.eta}</b></p></div>
      <button onClick={()=>setTab("profile")}>Gumi állapota <ChevronRight size={16}/></button>
    </section>

    <section className="forecast">
      <div className="sectionHead"><div><ThermometerSnowflake size={20}/><h3>Időjárás előrejelzés <span>(14 nap)</span></h3></div><em className={String(result.level)}>{result.level==="urgent"?<AlertTriangle size={14}/>:<Check size={14}/>} {result.level==="urgent"?"Figyelmeztetés":result.level==="warning"?"Készülj":"Rendben"}</em></div>
      <div className="days">{days.length?days.map((d,i)=><div className="day" key={d.date}><small>{i===0?"Ma":dayName(d.date)}</small><span>{icon(d.code)}</span><b>{d.max}°</b><i>{d.min}°</i></div>):<p>Friss adatok betöltése…</p>}</div>
    </section>

    <section className={"recommend "+result.level}><div className="recIcon">{result.level==="urgent"||result.level==="warning"?<Snowflake/>:<ShieldCheck/>}</div><div><small>INTELLIGENS FIGYELÉS</small><h2>{result.title}</h2><p>{result.text}</p></div><ChevronRight/></section>

    <section className="quickList">
      <div className="sectionHead"><div><CalendarDays size={20}/><h3>Következő teendők</h3></div><button className="linkBtn" onClick={()=>setTab("garage")}>Mind</button></div>
      {upcoming.slice(0,3).length?upcoming.slice(0,3).map(x=><div className="dueRow" key={x.label}><span>{x.label}</span><b className={x.days<0?"over":x.days<=30?"soon":""}>{x.days<0?"lejárt "+Math.abs(x.days)+" napja":x.days+" nap múlva"}</b></div>):<p className="empty">Még nincs rögzített határidő.</p>}
    </section>

    <section className="actions">
      <button className="primary" onClick={()=>switchTire(tire==="summer"?"winter":"summer")}><Check size={18}/> Már lecseréltem</button>
      <button onClick={notify}><Bell size={18}/> Értesítések</button>
      <button onClick={()=>setSettingsOpen(true)}><Settings size={18}/> Beállítások</button>
    </section>
  </div>;

  const ForecastView=()=> <div className="view">
    <section className="pageHero"><ThermometerSnowflake/><div><small>14 NAPOS TREND</small><h2>Előrejelzés</h2><p>{place.name} · automatikus kerékcsere-értékelés</p></div></section>
    <section className={"recommend "+result.level}><div className="recIcon"><Snowflake/></div><div><small>JAVASLAT</small><h2>{result.title}</h2><p>{result.text}</p></div></section>
    <section className="forecast full">
      {days.map((d,i)=><div className="forecastRow" key={d.date}><div><small>{i===0?"MA":dayName(d.date).toUpperCase()}</small><b>{new Intl.DateTimeFormat("hu-HU",{month:"short",day:"numeric"}).format(new Date(d.date+"T12:00:00"))}</b></div><span className="bigWx">{icon(d.code)}</span><div className="temp"><b>{d.max}°</b><span>{d.min}°</span></div><div className="risk"><span>{d.rain}% csapadék</span><span>{d.snow>0?d.snow+" cm hó":"nincs hó"}</span></div></div>)}
    </section>
  </div>;

  const GarageView=()=> <div className="view">
    <section className="pageHero"><Wrench/><div><small>SZERVIZNAPLÓ</small><h2>Autó karbantartás</h2><p>Határidők és elvégzett munkák egy helyen.</p></div></section>

    <section className="panel">
      <h3>Határidők</h3>
      <div className="formGrid">
        <label>Műszaki vizsga<input type="date" value={car.technical} onChange={e=>setCar(c=>({...c,technical:e.target.value}))}/></label>
        <label>Biztosítás<input type="date" value={car.insurance} onChange={e=>setCar(c=>({...c,insurance:e.target.value}))}/></label>
        <label>Autópálya matrica<input type="date" value={car.vignette} onChange={e=>setCar(c=>({...c,vignette:e.target.value}))}/></label>
        <label>Fékfolyadék<input type="date" value={car.brakeFluid} onChange={e=>setCar(c=>({...c,brakeFluid:e.target.value}))}/></label>
        <label>Vezérlés dátuma<input type="date" value={car.timingDate} onChange={e=>setCar(c=>({...c,timingDate:e.target.value}))}/></label>
        <label>Vezérlés utolsó km<input type="number" value={car.timingKm||""} onChange={e=>setCar(c=>({...c,timingKm:Number(e.target.value)||0}))}/></label>
      </div>
    </section>

    <section className="panel">
      <h3>Olajcsere</h3>
      <div className="formGrid">
        <label>Utolsó olajcsere<input type="date" value={car.oilDate} onChange={e=>setCar(c=>({...c,oilDate:e.target.value}))}/></label>
        <label>Km-óra akkor<input type="number" value={car.oilKm||""} onChange={e=>setCar(c=>({...c,oilKm:Number(e.target.value)||0}))}/></label>
        <label>Csereintervallum<input type="number" value={car.oilInterval} onChange={e=>setCar(c=>({...c,oilInterval:Number(e.target.value)||10000}))}/></label>
      </div>
      <div className="progressText">{car.oilKm>0&&car.mileage>0?Math.max(0,car.oilKm+car.oilInterval-car.mileage)+" km van hátra a következő olajcseréig":"Add meg az aktuális km-órát és az utolsó olajcserét."}</div>
    </section>

    <section className="panel">
      <h3>Új szervizbejegyzés</h3>
      <div className="formGrid">
        <label>Dátum<input type="date" value={serviceForm.date} onChange={e=>setServiceForm(f=>({...f,date:e.target.value}))}/></label>
        <label>Km<input type="number" value={serviceForm.mileage} onChange={e=>setServiceForm(f=>({...f,mileage:e.target.value}))}/></label>
        <label className="wideField">Munka<input placeholder="pl. olaj + szűrők" value={serviceForm.title} onChange={e=>setServiceForm(f=>({...f,title:e.target.value}))}/></label>
        <label className="wideField">Megjegyzés<textarea value={serviceForm.note} onChange={e=>setServiceForm(f=>({...f,note:e.target.value}))}/></label>
      </div>
      <button className="primaryBtn" onClick={addService}><Plus size={18}/> Mentés</button>
    </section>

    <section className="panel">
      <h3>Előzmények</h3>
      {services.length?services.map(s=><article className="history" key={s.id}><div><b>{s.title}</b><small>{s.date} · {s.mileage?s.mileage.toLocaleString("hu-HU")+" km":""}</small><p>{s.note}</p></div><button onClick={()=>setServices(x=>x.filter(v=>v.id!==s.id))}><Trash2 size={17}/></button></article>):<p className="empty">Még nincs szervizbejegyzés.</p>}
    </section>
  </div>;

  const ProfileView=()=> <div className="view">
    <section className="pageHero"><Car/><div><small>FORD FOCUS · LZE-585</small><h2>Autó állapota</h2><p>Gumi, akkumulátor és Carly diagnosztika.</p></div></section>

    <section className="panel">
      <div className="sectionHead"><h3>Alapadatok</h3><span className="healthPill">{health}/100</span></div>
      <div className="formGrid">
        <label>Aktuális km<input type="number" value={car.mileage||""} onChange={e=>setCar(c=>({...c,mileage:Number(e.target.value)||0}))}/></label>
        <label>Akkufeszültség<input type="number" step="0.1" value={car.battery} onChange={e=>setCar(c=>({...c,battery:Number(e.target.value)||0}))}/></label>
      </div>
      <div className="seg"><button className={tire==="summer"?"sel":""} onClick={()=>switchTire("summer")}><Sun size={16}/> Nyári</button><button className={tire==="winter"?"sel":""} onClick={()=>switchTire("winter")}><Snowflake size={16}/> Téli</button></div>
    </section>

    {(["summer","winter"] as Tire[]).map(kind=>{
      const t=kind==="summer"?car.summer:car.winter;
      return <section className="panel" key={kind}><h3>{kind==="summer"?"Nyári":"Téli"} garnitúra</h3><div className="formGrid">
        <label>Profilmélység (mm)<input type="number" step="0.1" value={t.profile} onChange={e=>setCar(c=>({...c,[kind]:{...c[kind],profile:Number(e.target.value)||0}}))}/></label>
        <label>DOT / év<input placeholder="pl. 2024" value={t.dot} onChange={e=>setCar(c=>({...c,[kind]:{...c[kind],dot:e.target.value}}))}/></label>
        <label>Szezonok száma<input type="number" value={t.seasons} onChange={e=>setCar(c=>({...c,[kind]:{...c[kind],seasons:Number(e.target.value)||0}}))}/></label>
        <label>Becsült futás (km)<input type="number" value={t.km||""} onChange={e=>setCar(c=>({...c,[kind]:{...c[kind],km:Number(e.target.value)||0}}))}/></label>
      </div></section>
    })}

    <section className="panel carly">
      <div className="carlyHead"><div className="carlyLogo">C</div><div><small>CARLY</small><h3>Diagnosztika napló</h3></div></div>
      <p className="muted">Másold be a Carly riport szövegét vagy a hibakódokat. Az app felismeri a P/B/C/U OBD-kódokat, ad egy érthető első értékelést és eltárolja őket.</p>
      <textarea className="carlyInput" placeholder="pl. P0420, P0301 vagy Carly riport..." value={carlyText} onChange={e=>setCarlyText(e.target.value)}/>
      <button className="primaryBtn" onClick={importCarly}><ClipboardList size={18}/> Carly riport mentése</button>
      <div className="diagList">{diagnostics.map(d=><article className="diag" key={d.id}><div><div className="diagTitle"><b>{d.codes.length?d.codes.join(" · "):"Riport"}</b>{d.severity&&<span className={"severity "+d.severity}>{d.severity==="high"?"Sürgős":d.severity==="medium"?"Figyeld":"Enyhe"}</span>}</div><small>{d.date}</small>{d.summary&&<p className="diagSummary">{d.summary}</p>}{d.advice&&<p className="diagAdvice"><strong>Teendő:</strong> {d.advice}</p>}<details><summary>Eredeti Carly szöveg</summary><p>{d.note}</p></details></div><div className="diagActions"><button className={d.resolved?"resolved":""} onClick={()=>setDiagnostics(x=>x.map(v=>v.id===d.id?{...v,resolved:!v.resolved}:v))}>{d.resolved?"Megoldva":"Aktív"}</button><button onClick={()=>setDiagnostics(x=>x.filter(v=>v.id!==d.id))}><Trash2 size={16}/></button></div></article>)}</div>
    </section>
  </div>;

  return <main className="app">
    <header className="top">
      <div className="brand"><div className="logo">◉</div><div><h1>KERÉK<span>CSERE</span></h1><p>BIZTONSÁGBAN MINDIG TOVÁBB</p></div></div>
      <button className="weather" onClick={()=>setSettingsOpen(true)}><MapPin size={18}/><div><small>{place.name}</small><strong>{current?String(current.max)+"°":"—"}</strong></div><b>{current?icon(current.code):"…"}</b></button>
    </header>

    {tab==="home"&&<HomeView/>}
    {tab==="forecast"&&<ForecastView/>}
    {tab==="garage"&&<GarageView/>}
    {tab==="profile"&&<ProfileView/>}

    {notice&&<div className="notice" onClick={()=>setNotice("")}>{notice}</div>}

    <nav>
      <button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><HomeIcon/><span>Főoldal</span></button>
      <button className={tab==="forecast"?"active":""} onClick={()=>setTab("forecast")}><ThermometerSnowflake/><span>Előrejelzés</span></button>
      <button className={tab==="garage"?"active":""} onClick={()=>setTab("garage")}><Wrench/><span>Szerviz</span></button>
      <button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><CircleGauge/><span>Autó</span></button>
    </nav>

    {settingsOpen&&<div className="backdrop" onClick={()=>setSettingsOpen(false)}><div className="sheet" onClick={e=>e.stopPropagation()}>
      <div className="handle"/><div className="sheetTitle"><div><small>BEÁLLÍTÁSOK</small><h2>Kerékcsere figyelő</h2></div><button onClick={()=>setSettingsOpen(false)}>×</button></div>
      <label>Figyelt hely</label><div className="places">{PLACES.map(p=><button key={p.name} className={place.name===p.name?"sel":""} onClick={()=>savePlace(p)}><MapPin size={16}/>{p.name}{place.name===p.name&&<Check size={16}/>}</button>)}<button onClick={useLocation}><LocateFixed size={16}/>Aktuális hely használata</button></div>
      <label>Értesítés</label><button className="wide" onClick={notify}><Bell size={17}/> Értesítések engedélyezése</button>
      <p className="hint">Az app megnyitáskor automatikusan frissíti a 14 napos trendet. A valódi, bezárt app mellett is érkező háttér-push külön szerveres push csatornát igényel; ezt nem jelöljük aktívnak addig, amíg nincs biztonságosan bekötve.</p>
    </div></div>}
  </main>;
}
