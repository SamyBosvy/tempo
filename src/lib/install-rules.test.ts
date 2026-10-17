import {describe,it,expect} from 'vitest';
import {installVisible,updateCanRefresh} from './install-rules';
describe('device installation',()=>{
 it('installed devices never show installation controls',()=>{expect(installVisible(true,false,true)).toBe(false);expect(installVisible(true,false,true,true)).toBe(false);});
 it('dismissal hides Today but keeps permanent Settings access',()=>{expect(installVisible(false,true,true)).toBe(false);expect(installVisible(false,true,true,true)).toBe(true);});
 it('only available installation paths appear',()=>{expect(installVisible(false,false,false)).toBe(false);expect(installVisible(false,false,true)).toBe(true);});
});
describe('safe update deferral',()=>{
 it('focus sessions prevent updates, including paused sessions',()=>{expect(updateCanRefresh(true,true,false)).toBe(false);});
 it('running prime prevents updates',()=>{expect(updateCanRefresh(true,false,true)).toBe(false);});
 it('waiting update appears once both sessions end',()=>{expect(updateCanRefresh(true,false,false)).toBe(true);expect(updateCanRefresh(false,false,false)).toBe(false);});
});
