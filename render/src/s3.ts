import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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

export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  if (!res.Body) throw new Error(`Empty S3 object at ${key}`);
  await pipeline(res.Body as Readable, createWriteStream(destPath));
}

export async function putFile(key: string, filePath: string, contentType: string): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile(filePath);
  await client.send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: body, ContentType: contentType }),
  );
}
