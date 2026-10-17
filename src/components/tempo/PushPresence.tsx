import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { focusTimer,onFocusMutation } from '@/lib/focus-timer';
import { syncFocusDeadline, retryFocusDeadline } from '@/lib/push';
import type { Settings } from '@/lib/settings';
import { toast } from 'sonner';
export function PushPresence({settings:s}:{settings:Settings}){
 useEffect(()=>{
 if(!s.push_enabled)return;
 // Delivery coordination only; no log, intention or event content is persisted.
 let reported=false;
 const beat=async()=>{if(document.hidden)return;const {error}=await supabase.from('push_presence').upsert({user_id:s.user_id,alive_until:new Date(Date.now()+65_000).toISOString()});if(error&&!reported){reported=true;toast.error("Couldn't coordinate reminders. Check your connection.");}};
 void beat();void syncFocusDeadline(s.user_id,focusTimer.get());
 const retry=()=>{void retryFocusDeadline(s.user_id);void beat();};
 window.addEventListener('online',retry);
 const t=setInterval(()=>{void beat();void retryFocusDeadline(s.user_id);},30_000);
 const visibility=()=>{if(!document.hidden)void beat();};document.addEventListener('visibilitychange',visibility);
 // Only explicit timer mutations write deadlines, never a computed countdown effect.
 const off=onFocusMutation(state=>{void syncFocusDeadline(s.user_id,state);});
 return()=>{clearInterval(t);off();window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',visibility);};
 },[s.push_enabled,s.user_id]);return null;
}
