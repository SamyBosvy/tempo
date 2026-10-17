import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireMember as requireSupabaseAuth } from './member-middleware';
import { validPushEndpoint } from './push-rules';
export const getPushPublicKey = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async () => {
 const seed=process.env['VAPID_KEY_SEED']; const email=process.env['OWNER_EMAIL'];
 if(!seed || !email) throw new Error('Push reminders are not configured.');
 const {vapidKeys}=await import('./push.server');
 return {publicKey:vapidKeys(seed,`mailto:${email}`).publicKey};
});
export const savePushSubscription=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({endpoint:z.string().max(2048).refine(validPushEndpoint),keys:z.object({auth:z.string().regex(/^[\w-]{22}$/),p256dh:z.string().regex(/^[\w-]{87}$/)}),timezone:z.string().max(80)}).parse(d)).handler(async({data,context})=>{
 try {new Intl.DateTimeFormat('en',{timeZone:data.timezone});}catch{throw new Error('Invalid time zone');}
 const {error}=await context.supabase.from('push_subscriptions').upsert({...data,user_id:context.userId},{onConflict:'user_id,endpoint'}); if(error)throw new Error("Couldn't save reminders.");
 const {error:e}=await context.supabase.from('user_settings').upsert({user_id:context.userId,push_enabled:true});if(e)throw new Error("Couldn't enable reminders.");return {ok:true};
});
