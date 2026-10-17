import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/jobs/send-reminders')({server:{handlers:{POST:async({request})=>{
 const denied=await authenticateCronRequest(request);if(denied)return denied;
 try {const body=await request.json();if(body.kind!=='reminders')return new Response('Invalid request',{status:400});
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {runPushJob}=await import('@/lib/push-job.server');await runPushJob(supabaseAdmin);return Response.json({ok:true});
 }catch{console.error('Scheduled reminder job failed');return Response.json({ok:false},{status:500});}
}}}});
