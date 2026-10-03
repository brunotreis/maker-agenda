(function(root){
  'use strict';
  const zone='America/Bahia';
  function institutional(email){return /^[^\s@]+@ufob\.edu\.br$/i.test(String(email).trim());}
  function dateKey(value){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
  function period(date,time,hours,now=Date.now()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new Error('Informe a data e o horário.');
    const duration=Number(hours);if(!Number.isFinite(duration)||duration<.25||duration>72||duration*4!==Math.round(duration*4))throw new Error('Use uma duração entre 15 minutos e 72 horas, em intervalos de 15 minutos.');
    const start=new Date(`${date}T${time}:00-03:00`);if(!Number.isFinite(start.getTime())||dateKey(start)!==date||Number(time.slice(0,2))>23||Number(time.slice(3))>59)throw new Error('Data ou horário inválidos.');
    if(start.getTime()<=now)throw new Error('Escolha um horário futuro.');
    return {starts_at:start.toISOString(),ends_at:new Date(start.getTime()+duration*3600000).toISOString()};
  }
  function overlaps(a,b){return Number(a.printer_id)===Number(b.printer_id)&&new Date(a.starts_at)<new Date(b.ends_at)&&new Date(b.starts_at)<new Date(a.ends_at);}
  function fifo(rows){return [...rows].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||String(a.id).localeCompare(String(b.id)));}
  function chronological(rows){return [...rows].sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)||Number(a.printer_id)-Number(b.printer_id)||String(a.id).localeCompare(String(b.id)));}
  function shiftDate(date,days){const d=new Date(`${date}T12:00:00-03:00`);d.setUTCDate(d.getUTCDate()+days);return dateKey(d);}
  function calendarRange(date,mode){
    const d=new Date(`${date}T12:00:00-03:00`);
    if(mode==='week'){const start=shiftDate(date,-((d.getUTCDay()+6)%7));return {start,end:shiftDate(start,7)};}
    const start=date.slice(0,7)+'-01';const next=new Date(`${start}T12:00:00-03:00`);next.setUTCMonth(next.getUTCMonth()+1);return {start,end:dateKey(next)};
  }
  function inDay(row,day){return new Date(row.starts_at)<new Date(`${shiftDate(day,1)}T00:00:00-03:00`)&&new Date(row.ends_at)>new Date(`${day}T00:00:00-03:00`);}
  const api={shiftDate,calendarRange,inDay,zone,institutional,dateKey,period,overlaps,fifo,chronological};root.MakerDomain=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
