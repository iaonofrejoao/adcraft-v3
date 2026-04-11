import AWS from 'aws-sdk';
import * as crypto from 'crypto';

// Setup do cliente AWS apontado para o Cloudflare envs.
const r2 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'adcraft-assets';

export async function uploadToR2(buffer: Buffer, mimeType: string, prefix: string = 'assets'): Promise<string> {
  const hash = crypto.randomUUID();
  const key = `${prefix}/${hash}`;
  
  await r2.putObject({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  }).promise();

  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
}
