import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/integrations/supabase/types';
import { getAccessToken } from './google.server';
import { deliverPush, vapidKeys } from './push.server';
import { checkinDue, focusDue, presenceAlive, primeDue, reminderKey, weeklyDue, zonedParts } from './push-rules';
type DB=SupabaseClient<Database>;
type Event={id:string;start:string;end:string;stressful:boolean};
async function calendarEvents(db:DB,s:Tables<'user_settings'>,now:number):Promise<Event[]>{
 const token=await getAccessToken(s.user_id);if(!token)return [];
 const {data:flags,error}=await db.from('event_flags').select('event_id,stressful').eq('user_id',s.user_id).gte('end_at',new Date(now-24*3600_000).toISOString()).lt('start_at',new Date(now+Math.max(s.prime_lead_min,60)*60_000).toISOString());if(error)throw error;
 const out:Event[]=[];
 for(const id of s.calendar_ids){let page:string|undefined;do{
 const q=new URLSearchParams({timeMin:new Date(now-24*3600_000).toISOString(),timeMax:new Date(now+Math.max(s.prime_lead_min,60)*60_000).toISOString(),singleEvents:'true',maxResults:'250',fields:'nextPageToken,items(id,summary,status,transparency,start(dateTime),end(dateTime))'});if(page)q.set('pageToken',page);
 const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${q}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Calendar reminder read failed');
 const body=await response.json() as {nextPageToken?:string;items?:{id:string;summary?:string;status?:string;transparency?:string;start?:{dateTime?:string};end?:{dateTime?:string}}[]};page=body.nextPageToken;
 for(const e of body.items??[]){if(e.status==='cancelled'||e.transparency==='transparent'||!e.start?.dateTime||!e.end?.dateTime)continue;
 const eventId=`${id}:${e.id}`;const flag=flags?.find(f=>f.event_id===eventId);
 const match=s.keywords.some(k=>k.trim()&&(e.summary??'').toLowerCase().includes(k.toLowerCase()));
 out.push({id:eventId,start:e.start.dateTime,end:e.end.dateTime,stressful:flag?.stressful??match});}
 }while(page);}
 return out;
}
export async function runPushJob(db:DB){
 const now=Date.now(),seed=process.env['VAPID_KEY_SEED'],email=process.env['OWNER_EMAIL'];if(!seed||!email)throw new Error('Push configuration missing');
 const vapid=vapidKeys(seed,`mailto:${email}`);let sent=0;
 for(let offset=0;;offset+=20){
 const {data:users,error}=await db.from('user_settings').select('*').eq('push_enabled',true).order('user_id').range(offset,offset+19);if(error)throw error;
 for(const s of users??[]){try{
 const {data:role,error:roleError}=await db.from('user_roles').select('role').eq('user_id',s.user_id).maybeSingle();if(roleError)throw roleError;if(!role)continue;
 const [{data:subs,error:e1},{data:presence,error:e2},{data:deadlines,error:e3}]=await Promise.all([db.from('push_subscriptions').select('*').eq('user_id',s.user_id).order('created_at'),db.from('push_presence').select('alive_until').eq('user_id',s.user_id).maybeSingle(),db.from('push_focus_deadlines').select('*').eq('user_id',s.user_id)]);if(e1||e2||e3)throw new Error('Reminder data unavailable');
 if(!subs?.length||presenceAlive(now,presence?.alive_until??null))continue;
 // One canonical account timezone prevents per-device duplicate weekly reminders.
 const tz=subs[0]?.timezone??'UTC',local=zonedParts(now,tz);
 const notify=async(key:string,title:string,body:string,url:string):Promise<boolean>=>{
  const {data:active,error:activeError}=await db.from('user_roles').select('role').eq('user_id',s.user_id).maybeSingle();if(activeError)throw activeError;if(!active)return false;
  // Unique insert is the atomic claim shared by all devices and open-app notifiers.
  const {error:claim}=await db.from('reminder_claims').insert({user_id:s.user_id,reminder_key:key});if(claim){if(claim.code==='23505')return true;throw claim;}
  let delivered=false;
  await Promise.all(subs.map(async sub=>{try{const keys=sub.keys as {auth:string;p256dh:string};const status=await deliverPush(sub.endpoint,keys,{title,body,tag:key,url},vapid);if(status===404||status===410){const {error}=await db.from('push_subscriptions').delete().eq('id',sub.id);if(error)throw error;}else if(status<200||status>=300)console.error('Push delivery rejected',status);else {sent++;delivered=true;}}catch{console.error('Push delivery failed');}}));
  if(!delivered){const {error}=await db.from('reminder_claims').delete().eq('user_id',s.user_id).eq('reminder_key',key);if(error)throw error;}
  return delivered;
 };
 for(const d of deadlines??[]){let delivered=!s.end_notify;if(s.end_notify&&focusDue(now,Date.parse(d.end_at)))delivered=await notify(reminderKey('focus',d.session_id,new Date(d.end_at).toISOString()),'Focus done',"Time's up. Wrap up when you're ready.",'/focus');if(Date.parse(d.end_at)<=now&&delivered){const {error}=await db.from('push_focus_deadlines').delete().eq('user_id',s.user_id).eq('session_id',d.session_id);if(error)throw error;}}
 if(s.weekly_review_notify&&weeklyDue(local.weekday,local.hour))await notify(reminderKey('weekly',local.day,''),'Tempo','Your week in review is ready.','/insights#last-week');
 if(!s.notifications&&!s.checkin_notify)continue;
 const events=await calendarEvents(db,s,now);
 const [{data:ratings,error:rErr},{data:dismissed,error:dErr}]=await Promise.all([db.from('energy_ratings').select('event_id').eq('user_id',s.user_id).eq('kind','after_meeting').gte('at',new Date(now-48*3600_000).toISOString()),db.from('checkin_dismissals').select('event_id,local_date').eq('user_id',s.user_id).gte('local_date',zonedParts(now-48*3600_000,tz).day)]);if(rErr||dErr)throw new Error('Check-in eligibility unavailable');
 for(const e of events){if(!e.stressful)continue;
 if(s.notifications&&primeDue(now,Date.parse(e.start),s.prime_lead_min)){const time=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(e.start));await notify(reminderKey('prime',e.id,new Date(e.start).toISOString()),'Tempo',`Big meeting at ${time} · two minutes to settle?`,`/prime?event=${encodeURIComponent(e.id)}&at=${encodeURIComponent(new Date(e.start).toISOString())}&auto=1`);}
 if(s.checkin_notify&&checkinDue(now,Date.parse(e.end),Boolean(ratings?.some(r=>r.event_id===e.id)),Boolean(dismissed?.some(d=>d.event_id===e.id&&d.local_date===zonedParts(Date.parse(e.end),tz).day))))await notify(reminderKey('checkin',e.id,new Date(e.end).toISOString()),'Tempo','How was that meeting? One tap to rate it.','/today');}
 }catch{console.error('Reminder processing failed for an account');}}
 if((users?.length??0)<20)break;
 }
 return {sent};
}
