import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({});

function bucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var is not set");
  return bucket;
}

export async function putJson(key: string, body: unknown): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: JSON.stringify(body, null, 2),
      ContentType: "application/json",
    }),
  );
}

export async function getJson<T>(key: string): Promise<T> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  const text = await res.Body?.transformToString("utf-8");
  if (!text) throw new Error(`Empty S3 object at ${key}`);
  return JSON.parse(text) as T;
}

export async function getBuffer(key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty S3 object at ${key}`);
  return Buffer.from(bytes);
}

export async function putBinary(key: string, body: Buffer, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: body, ContentType: contentType }),
  );
}

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS });
}

export async function getPresignedPutUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS });
}

export interface ListedObject {
  key: string;
  lastModified: Date;
}

export async function listObjects(prefix: string): Promise<ListedObject[]> {
  const found: ListedObject[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucketName(), Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const item of res.Contents ?? []) {
      if (item.Key && item.LastModified) found.push({ key: item.Key, lastModified: item.LastModified });
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
  return found;
}
