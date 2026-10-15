import {describe,it,expect} from 'vitest';
import {addKeyword,resolveTheme} from './settings-rules';
describe('Settings keyword rules',()=>{
  it('trims added keywords',()=>expect(addKeyword(['review'],'  Interview  ')).toEqual({ok:true,keywords:['review','Interview']}));
  it('deduplicates ignoring case',()=>expect(addKeyword(['Review'],' review ')).toMatchObject({ok:false}));
  it('rejects empty keywords',()=>expect(addKeyword([],'  ')).toMatchObject({ok:false}));
  it('allows at most 30 keywords',()=>{expect(addKeyword(Array.from({length:29},(_,i)=>`${i}`),'new')).toMatchObject({ok:true});expect(addKeyword(Array.from({length:30},(_,i)=>`${i}`),'new')).toMatchObject({ok:false});});
  it('allows at most 40 characters',()=>{expect(addKeyword([],'a'.repeat(40))).toMatchObject({ok:true});expect(addKeyword([],'a'.repeat(41))).toMatchObject({ok:false});});
});
describe('Theme resolution',()=>{
  it('system follows light and dark preferences',()=>{expect(resolveTheme('system',true)).toBe('light');expect(resolveTheme('system',false)).toBe('dark');});
  it('explicit choices override system',()=>{expect(resolveTheme('dark',true)).toBe('dark');expect(resolveTheme('light',false)).toBe('light');});
  it('new users follow the system',()=>expect(resolveTheme(undefined,true)).toBe('light'));
});