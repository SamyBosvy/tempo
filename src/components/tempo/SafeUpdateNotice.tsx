import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useFocusState,focusTimer } from '@/lib/focus-timer';
import { loadPrime,primeProgress } from '@/lib/prime-session';
import { useNow } from '@/lib/use-now';
import { updateCanRefresh } from '@/lib/install-rules';
import { activateWaitingWorker,onWaitingWorker,waitingWorker } from '@/lib/pwa';
export function SafeUpdateNotice(){
 const focus=useFocusState(),now=useNow(1000);const [waiting,setWaiting]=useState(false);
 useEffect(()=>{const check=()=>setWaiting(Boolean(waitingWorker()));check();return onWaitingWorker(check);},[]);
 const prime=loadPrime();const activePrime=Boolean(prime&&!primeProgress(prime,now).done);
 useEffect(()=>{if(!updateCanRefresh(waiting,Boolean(focus),activePrime)){toast.dismiss('tempo-update');return;}
 toast('New version ready',{id:'tempo-update',duration:Infinity,action:{label:'Refresh',onClick:()=>{const prime=loadPrime();if(focusTimer.get()||(prime&&!primeProgress(prime,Date.now()).done))return;activateWaitingWorker();}}});
 return()=>{toast.dismiss('tempo-update');};
 },[waiting,focus,activePrime]);return null;
}
