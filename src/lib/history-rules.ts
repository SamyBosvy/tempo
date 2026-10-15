import { localDateKey,startOfLocalDay,atLocal } from './timeline';
export type HistoryType='all'|'session'|'prime'|'rating';
export type HistoryEntry={type:Exclude<HistoryType,'all'>;id:string;at:string;actual_min?:number;planned_min?:number;intention?:string|null;done_note?:string|null;energy_before?:number|null;energy_after?:number|null;parked_thoughts?:string[]|null;pattern?:string;duration_s?:number;rating?:number;kind?:string;note?:string|null;intent_outcome?:string|null;interruptions:{id:string;source:string|null;reason:string;custom_label:string|null}[]};
export function validateSession(date:string,time:string,length:string,now=new Date()):{ok:true;start:string;end:string;minutes:number}|{ok:false;error:string}{
 const minutes=Number(length);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return {ok:false,error:'Choose a valid date and time.'};
 const start=new Date(`${date}T${time}:00`);
 if(!Number.isFinite(start.getTime())||localDateKey(start)!==date||start.getHours()!==Number(time.slice(0,2))||start.getMinutes()!==Number(time.slice(3)))return {ok:false,error:'Choose a valid local date and time.'};
 if(!Number.isInteger(minutes)||minutes<1||minutes>600)return {ok:false,error:'Length must be 1–600 whole minutes.'};
 const end=new Date(start.getTime()+minutes*60000);
 if(date>localDateKey(now)||end>now)return {ok:false,error:'The session must end no later than now.'};
 return {ok:true,start:start.toISOString(),end:end.toISOString(),minutes};
}
export function historyQuery(day:string,type:HistoryType,search:string,page=0,offset=0){const end=startOfLocalDay(new Date(`${day}T12:00:00`));end.setDate(end.getDate()+1-page*7);const start=new Date(end);start.setDate(start.getDate()-7);return {_from:start.toISOString(),_to:end.toISOString(),_type:type,_search:search.trim().replace(/[\\%_]/g,'\\$&'),_offset:offset};}
export const HISTORY_SEARCH_PAGE_SIZE=50;
export function historySearchQuery(type:HistoryType,search:string,offset=0){return {_type:type,_search:search.trim().replace(/[\\%_]/g,'\\$&'),_offset:Math.max(0,offset)};}
export function monthShade(minutes:number,max:number):0|1|2|3|4 {if(minutes<=0||max<=0)return 0;return Math.min(4,Math.ceil(minutes/max*4)) as 1|2|3|4;}
export const MONTH_SHADE_OPACITY=[0,.15,.35,.6,.85] as const;
export function daySummary(entries:HistoryEntry[]){const sorted=[...entries].sort((a,b)=>a.at.localeCompare(b.at)),ratings=sorted.filter(e=>e.type==='rating');return {minutes:entries.reduce((n,e)=>n+(e.type==='session'?e.actual_min??0:0),0),primes:entries.filter(e=>e.type==='prime').length,morning:ratings.find(e=>e.kind==='morning')?.rating??null,last:ratings.at(-1)?.rating??null};}
export function historyRibbon(entries:HistoryEntry[],day:string,workStart:string,workEnd:string){const d=new Date(`${day}T12:00:00`),start=atLocal(d,workStart).getTime(),end=atLocal(d,workEnd).getTime();if(end<=start)return [];return entries.filter(e=>e.type!=='rating').map(e=>{const a=Math.max(start,new Date(e.at).getTime()),b=Math.min(end,new Date(e.at).getTime()+(e.type==='session'?(e.actual_min??0)*60:(e.duration_s??0))*1000);return {id:e.id,type:e.type,left:100*(a-start)/(end-start),width:100*(b-a)/(end-start)};}).filter(x=>x.width>0);}
