// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {vapidKeys} from './push.server';
describe('stable private push identity',()=>{
 it('same stored seed always derives the same VAPID key pair',()=>{const a=vapidKeys('test-only-seed','mailto:test@example.org');const b=vapidKeys('test-only-seed','mailto:test@example.org');expect(a.publicKey).toBe(b.publicKey);expect(a.privateKey).toBe(b.privateKey);expect(Buffer.from(a.publicKey,'base64url').length).toBe(65);expect(Buffer.from(a.privateKey,'base64url').length).toBe(32);expect(a.publicKey).not.toBe(vapidKeys('another-test-seed','mailto:test@example.org').publicKey);});
});
