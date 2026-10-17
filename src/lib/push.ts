import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FocusState } from './focus-timer';
let pending: {userId:string; state:FocusState|null}|null=null;
let draining=false;
export async function syncFocusDeadline(userId:string,state:FocusState|null) {
 pending={userId,state}; if(draining)return; draining=true;
 try {while(pending){const item=pending;pending=null;
  const s=item.state;
  if(s&&!s.paused&&!s.overtime&&!s.signalled){
    const end=new Date(s.resumedAt+s.targetMin*60_000-s.accumulatedMs).toISOString();
    const {error}=await supabase.from('push_focus_deadlines').upsert({user_id:item.userId,session_id:s.id,end_at:end},{onConflict:'user_id,session_id'});if(error)throw error;
    try {localStorage.setItem('tempo.push.focusId',s.id);}catch{}
  }else{
    let id=s?.id;try{id??=localStorage.getItem('tempo.push.focusId')??undefined;}catch{}
    if(id){const {error}=await supabase.from('push_focus_deadlines').delete().eq('user_id',item.userId).eq('session_id',id);if(error)throw error;}
    try{localStorage.removeItem('tempo.push.focusId');}catch{}
  }
 }}catch{toast.error("Couldn't update closed-app focus reminders. Keep Tempo open until you're online.");}finally{draining=false;}
}

export async function claimNotification(key:string) {
 const {data,error}=await supabase.rpc('claim_reminder',{_key:key});
 if(error){toast.error("Couldn't check this reminder. Try syncing.");return false;} return data===true;
}
