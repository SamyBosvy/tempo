// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {vapidKeys} from './push.server';
describe('stable private push identity',()=>{
 it('same stored seed always derives the same VAPID key pair',()=>{const a=vapidKeys('test-only-seed','mailto:test@example.org');const b=vapidKeys('test-only-seed','mailto:test@example.org');expect(a.publicKey).toBe(b.publicKey);expect(a.privateKey).toBe(b.privateKey);expect(Buffer.from(a.publicKey,'base64url').length).toBe(65);expect(Buffer.from(a.privateKey,'base64url').length).toBe(32);expect(a.publicKey).not.toBe(vapidKeys('another-test-seed','mailto:test@example.org').publicKey);});
});

import { webcrypto } from 'node:crypto';
import { p256 } from '@noble/curves/nist.js';
import { buildPushPayload } from '@block65/webcrypto-web-push';
it('builds an encrypted VAPID-authenticated payload without exposing message content',async()=>{
 const pair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const pub=await webcrypto.subtle.exportKey('raw',pair.publicKey);
 const sub={endpoint:'https://fcm.googleapis.com/test',expirationTime:null,keys:{p256dh:Buffer.from(pub).toString('base64url'),auth:Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64url')}};
 const vapid=vapidKeys('test-only-seed','mailto:test@example.org');
 const payload=await buildPushPayload({data:JSON.stringify({body:'Private test reminder',url:'/focus'}),options:{ttl:300}},sub,vapid);
 expect(payload.method).toBe('post');expect(payload.headers['content-encoding']).toBe('aes128gcm');expect(payload.headers['ttl']).toBe('300');expect(Buffer.from(payload.body).toString()).not.toContain('Private test reminder');expect(payload.body.byteLength).toBeGreaterThan(100);
 const privateBytes=Buffer.from(vapid.privateKey,'base64url');expect(Buffer.from(p256.getPublicKey(privateBytes,false)).toString('base64url')).toBe(vapid.publicKey);
});
