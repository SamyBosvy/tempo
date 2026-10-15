import {it,expect,describe} from 'vitest';
import {daySummary,validateSession,historyQuery,historyRibbon,type HistoryEntry} from './history-rules';
const entry=(type:HistoryEntry['type'],at:string,extra:Partial<HistoryEntry>={}):HistoryEntry=>({id:at,type,at,interruptions:[],...extra});
describe('History rules',()=>{
 it('sums focus and primes with morning to latest rating',()=>{expect(daySummary([entry('session','2026-10-13T09:00:00',{actual_min:130}),entry('prime','2026-10-13T11:00:00'),entry('prime','2026-10-13T12:00:00'),entry('rating','2026-10-13T08:00:00',{kind:'morning',rating:3}),entry('rating','2026-10-13T15:00:00',{rating:4})])).toEqual({minutes:130,primes:2,morning:3,last:4});});
 it('rejects future dates',()=>expect(validateSession('2026-10-16','09:00','25',new Date(2026,9,15,12))).toMatchObject({ok:false}));
 it('rejects an end in the future',()=>expect(validateSession('2026-10-15','11:50','25',new Date(2026,9,15,12))).toMatchObject({ok:false}));
 it('accepts a session ending at now with equal length',()=>expect(validateSession('2026-10-15','11:30','30',new Date(2026,9,15,12))).toMatchObject({ok:true,minutes:30}));
 it('rejects invalid dates and non-integer lengths',()=>{expect(validateSession('2026-02-30','09:00','25')).toMatchObject({ok:false});expect(validateSession('2026-10-13','09:00','2.5')).toMatchObject({ok:false});});
 it('builds a local seven-day window including today',()=>{const q=historyQuery('2026-10-15','prime','HELLO');expect(new Date(q._from).getDate()).toBe(9);expect(new Date(q._to).getDate()).toBe(16);expect(q._type).toBe('prime');expect(q._search).toBe('HELLO');});
 it('escapes literal search wildcards',()=>expect(historyQuery('2026-10-15','all','50%_\\')._search).toBe('50\\%\\_\\\\'));
 it('clips ribbon to work hours',()=>{expect(historyRibbon([entry('session','2026-10-13T07:30:00',{actual_min:60})],'2026-10-13','08:00','18:00')[0]).toMatchObject({left:0,width:5});});
});
