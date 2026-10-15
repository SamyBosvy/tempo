import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCalendarEvents } from './google.functions';
import { useSettings } from './settings';
import { localDateFromKey } from './fix-rules';
import { localDateKey, startOfLocalDay } from './timeline';
import { meetingDays, meetingWeeks, mondayKey, type InsightData, type Period } from './insights-rules';
export function useInsights(period:Period){
 const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return useQuery({queryKey:['insights',tz,period,localDateKey(new Date())],queryFn:async()=>{
  const {data,error}=await supabase.rpc('get_insights',{_tz:tz,_period:period});
  if(error){toast.error("Couldn't load insights. Try again.");throw error;}
  return data as unknown as InsightData;
 }});
}
export function useInsightCalendar(d:InsightData|undefined){
 const {data:settings}=useSettings(); const fetchEvents=useServerFn(getCalendarEvents);
 const from=d ? [d.start,d.trend_start].sort()[0] : undefined;
 return useQuery({queryKey:['gcal','insights',from,d?.end,settings?.calendar_ids,settings?.work_start,settings?.work_end],enabled:!!d && !!settings,queryFn:async()=>{
  if(!d || !settings || !from) throw new Error('Not ready');
  const end=startOfLocalDay(localDateFromKey(d.end));end.setDate(end.getDate()+1);
  const res=await fetchEvents({data:{timeMin:startOfLocalDay(localDateFromKey(from)).toISOString(),timeMax:end.toISOString()}}).catch(e=>{toast.error('Calendar unavailable right now.');throw e;});
  if(res.status!=='connected') return {status:res.status,days:[],weeks:[]};
  const days=meetingDays(res.events.map(e=>({...e,source:'google' as const})),from,d.end,settings.work_start,settings.work_end);
  return {status:res.status,days,weeks:meetingWeeks(days).filter(w=>w.week<mondayKey()).slice(-12)};
 }});
}
