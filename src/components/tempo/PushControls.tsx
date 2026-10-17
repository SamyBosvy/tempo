import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { getPushPublicKey, savePushSubscription } from '@/lib/push.functions';
import { supabase } from '@/integrations/supabase/client';
import { useSaveSettings, type Settings } from '@/lib/settings';
import { syncFocusDeadline } from '@/lib/push';
import { focusTimer } from '@/lib/focus-timer';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
export function PushControls({settings:s}:{settings:Settings}){
 const keyFn=useServerFn(getPushPublicKey),saveFn=useServerFn(savePushSubscription),save=useSaveSettings(),qc=useQueryClient();
 const [busy,setBusy]=useState(false),[supported,setSupported]=useState(false),[device,setDevice]=useState(false);
 useEffect(()=>{setSupported('PushManager' in window&&'serviceWorker' in navigator);if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(r=>r?.pushManager.getSubscription()).then(sub=>setDevice(Boolean(sub))).catch(()=>{});},[]);
 async function change(on:boolean){if(busy)return;setBusy(true);let created:PushSubscription|null=null;try{
 const reg=await navigator.serviceWorker.getRegistration('/');
 if(!on){await save.mutateAsync({push_enabled:false});const sub=await reg?.pushManager.getSubscription();if(sub){const {error}=await supabase.from('push_subscriptions').delete().eq('user_id',s.user_id).eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe();}const {error}=await supabase.from('push_focus_deadlines').delete().eq('user_id',s.user_id);if(error)throw error;setDevice(false);return;}
 if(!reg?.active)throw new Error('Install or open the published Tempo app to enable closed-app reminders.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Allow notifications in your browser settings first.');
 const {publicKey}=await keyFn();const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 let sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});created=sub;}
 const json=sub.toJSON();if(!json.endpoint||!json.keys?.['auth']||!json.keys['p256dh'])throw new Error('This browser could not create a subscription.');
 await saveFn({data:{endpoint:json.endpoint,keys:{auth:json.keys['auth'],p256dh:json.keys['p256dh']},timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}});await syncFocusDeadline(s.user_id,focusTimer.get());setDevice(true);await qc.invalidateQueries({queryKey:['settings']});toast.success('Closed-app reminders enabled on this device.');
 }catch(e){if(created)await created.unsubscribe().catch(()=>false);toast.error(e instanceof Error?e.message:"Couldn't change closed-app reminders.");}finally{setBusy(false);}}
 return <div className="space-y-2"><label className="flex min-h-12 items-center justify-between gap-3"><span className="min-w-0"><span className="block text-sm font-semibold">Reminders when Tempo is closed</span><span className="block text-sm text-muted-foreground">Private reminders on this device, checked every five minutes.</span></span><Switch aria-label="Reminders when Tempo is closed" checked={s.push_enabled&&device} disabled={busy||!supported} onCheckedChange={v=>{void change(v);}}/></label><p className="text-xs text-muted-foreground">On iPhone, add Tempo to your home screen first. Available in the published app.</p></div>;
}
