import { p256 } from '@noble/curves/nist.js';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { createHash } from 'node:crypto';
import { validPushEndpoint } from './push-rules';
export function vapidKeys(seed: string, subject: string) {
  const hash = createHash('sha256').update(seed).digest('hex');
  const n = BigInt('0x' + hash) % (BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551') - 1n) + 1n;
  const privateBytes = Buffer.from(n.toString(16).padStart(64,'0'),'hex');
  return { privateKey: privateBytes.toString('base64url'), publicKey: Buffer.from(p256.getPublicKey(privateBytes, false)).toString('base64url'), subject };
}
export async function deliverPush(endpoint: string, keys: {auth:string;p256dh:string}, data: {title:string;body:string;tag:string;url:string}, vapid: ReturnType<typeof vapidKeys>) {
 if(!validPushEndpoint(endpoint)) return 410;
 const payload = await buildPushPayload({data:JSON.stringify(data),options:{ttl:300}}, {endpoint,keys,expirationTime:null},vapid);
 const res = await fetch(endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(8000)});
 return res.status;
}
