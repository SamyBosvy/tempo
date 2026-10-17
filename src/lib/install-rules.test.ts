import {describe,it,expect} from 'vitest';
import {installVisible,updateCanRefresh,installPlatform} from './install-rules';
describe('device installation',()=>{
 it('installed devices never show installation controls',()=>{expect(installVisible(true,false,true)).toBe(false);expect(installVisible(true,false,true,true)).toBe(false);});
 it('dismissal hides Today but keeps permanent Settings access',()=>{expect(installVisible(false,true,true)).toBe(false);expect(installVisible(false,true,true,true)).toBe(true);});
 it('only available installation paths appear',()=>{expect(installVisible(false,false,false)).toBe(false);expect(installVisible(false,false,true)).toBe(true);});
 it('permanent download remains available without a prompt or after dismissal',()=>{expect(installVisible(false,true,false,true)).toBe(true);expect(installVisible(false,false,false,true)).toBe(true);expect(installVisible(true,true,false,true)).toBe(false);});
 it.each([
  ['Mozilla Android Chrome/130 Safari/537','android-chrome'],
  ['Mozilla iPhone Safari/604','ios-safari'],
  ['Mozilla iPhone CriOS/130 Safari/604','ios-other'],
  ['Mozilla iPhone FxiOS/130 Safari/604','ios-other'],
  ['Mozilla Android SamsungBrowser/26 Chrome/130','samsung'],
  ['Mozilla Android Firefox/130','firefox'],
  ['Mozilla Windows Chrome/130 Safari/537 Edg/130','desktop-chromium'],
  ['Mozilla Macintosh Safari/605','other'],
 ])('detects installation platform %s',(ua,expected)=>{expect(installPlatform(ua)).toBe(expected);});
 it('detects iPad Safari desktop mode',()=>{expect(installPlatform('Mozilla Macintosh Safari/605',5)).toBe('ios-safari');});
});
describe('safe update deferral',()=>{
 it('focus sessions prevent updates, including paused sessions',()=>{expect(updateCanRefresh(true,true,false)).toBe(false);});
 it('running prime prevents updates',()=>{expect(updateCanRefresh(true,false,true)).toBe(false);});
 it('waiting update appears once both sessions end',()=>{expect(updateCanRefresh(true,false,false)).toBe(true);expect(updateCanRefresh(false,false,false)).toBe(false);});
});
