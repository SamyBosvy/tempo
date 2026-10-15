import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {currentUserId} from '@/lib/settings';
import {enqueue} from '@/lib/offline-queue';
import {validateSession,type HistoryEntry} from '@/lib/history-rules';
import {localDateKey,fmtTime} from '@/lib/timeline';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {EnergyPicker} from './bits';
export function refreshHistory(qc:ReturnType<typeof useQueryClient>){for(const key of ['history','history-month','insights','daylogs'])void qc.invalidateQueries({queryKey:[key]});}
export function HistorySessionDialog({entry,onClose,onDelete}:{entry?:HistoryEntry;onClose:()=>void;onDelete?:()=>void}){
 const qc=useQueryClient(),isSession=!entry||entry.type==='session';
 const [date,setDate]=useState(localDateKey(entry?new Date(entry.at):new Date()));const [time,setTime]=useState(entry?fmtTime(entry.at):'09:00');const [length,setLength]=useState(String(entry?.actual_min??25));
 const [text,setText]=useState(entry?.type==='rating'?entry.note??'':entry?.intention??'');const [note,setNote]=useState(entry?.done_note??'');
 const [before,setBefore]=useState(entry?.energy_before??null),[after,setAfter]=useState(entry?.type==='rating'?entry.rating??null:entry?.energy_after??null);const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){const valid=isSession?validateSession(date,time,length):null;if(valid&&!valid.ok){setError(valid.error);return;}setError('');setBusy(true);
 try{if(!entry&&valid?.ok){const uid=await currentUserId();enqueue('focus_sessions',{id:crypto.randomUUID(),user_id:uid,started_at:valid.start,ended_at:valid.end,planned_min:valid.minutes,actual_min:valid.minutes,intention:text.trim()||null,energy_before:before,energy_after:after});toast.success('Session saved.');}
 else if(entry){const table=entry.type==='session'?'focus_sessions':entry.type==='prime'?'prime_sessions':'energy_ratings';const patch=entry.type==='session'&&valid?.ok?{started_at:valid.start,ended_at:valid.end,actual_min:valid.minutes,intention:text.trim()||null,done_note:note.trim()||null,energy_before:before,energy_after:after}:entry.type==='prime'?{intention:text.trim()||null}:{note:text.trim()||null,rating:after??3};const {error}=await supabase.from(table).update(patch).eq('id',entry.id);if(error)throw error;}
 refreshHistory(qc);onClose();}catch{toast.error("Couldn't save. Try again.");}finally{setBusy(false);}}
 return <Dialog open onOpenChange={o=>!o&&onClose()}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{entry?'Edit entry':'Add a past session'}</DialogTitle><DialogDescription>{isSession?'Dates and times are local.':'Update this entry.'}</DialogDescription></DialogHeader>
 {isSession&&<><Label htmlFor="history-date">Date</Label><Input id="history-date" type="date" max={localDateKey(new Date())} value={date} onChange={e=>setDate(e.target.value)}/><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="history-time">Start time</Label><Input id="history-time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></div><div><Label htmlFor="history-length">Length (min)</Label><Input id="history-length" type="number" min={1} max={600} value={length} onChange={e=>setLength(e.target.value)}/></div></div></>}
 <Label htmlFor="history-text">{entry?.type==='rating'?'Note':'Intention'}</Label><Input id="history-text" maxLength={200} value={text} onChange={e=>setText(e.target.value)}/>
 {isSession&&<>{entry&&<><Label htmlFor="history-note">What got done</Label><Input id="history-note" maxLength={200} value={note} onChange={e=>setNote(e.target.value)}/></>}<p className="text-sm font-semibold">Energy before (optional)</p><EnergyPicker label="Energy before" value={before} onChange={setBefore}/></>}
 {(isSession||entry?.type==='rating')&&<><p className="text-sm font-semibold">{isSession?'Energy after (optional)':'Energy'}</p><EnergyPicker label="Energy after" value={after} onChange={setAfter}/></>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 <DialogFooter>{onDelete&&<Button variant="ghost" className="text-destructive" disabled={busy} onClick={onDelete}>Delete</Button>}<Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</Button></DialogFooter></DialogContent></Dialog>;
}
