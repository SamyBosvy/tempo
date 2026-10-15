import {describe,it,expect} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {renderHook,act} from '@testing-library/react';
import {trackQuerySync,useLastSynced,markSynced} from './sync-status';
describe('Sync status',()=>{
  it('records successful queue delivery timestamps',()=>{const {result}=renderHook(useLastSynced);act(()=>markSynced(12345));expect(result.current).toBe(12345);});
  it('records real refetches but not optimistic cache updates or failed queries',async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),stop=trackQuerySync(client),{result}=renderHook(useLastSynced);
    act(()=>markSynced(100));act(()=>client.setQueryData(['optimistic'],1));expect(result.current).toBe(100);
    await act(async()=>{await client.fetchQuery({queryKey:['remote'],queryFn:async()=>2});});
    expect(result.current).toBe(client.getQueryState(['remote'])?.dataUpdatedAt);
    const successful=result.current;
    await act(async()=>{await client.fetchQuery({queryKey:['failed'],queryFn:async()=>{throw new Error('offline');}}).catch(()=>{});});
    expect(result.current).toBe(successful);stop();client.clear();
  });
});