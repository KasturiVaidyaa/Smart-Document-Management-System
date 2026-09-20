import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

const region = process.env.AWS_REGION || "ap-south-1";

export const s3Bucket =
  process.env.S3_BUCKET || process.env.S3_BUCKET_NAME;

export const s3EnvPrefix = process.env.S3_ENV_PREFIX || "dev";

export const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export function assertS3Configured() {
  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !s3Bucket
  ) {
    const err = new Error("S3 is not configured");
    err.statusCode = 503;
    throw err;
  }
}

export function safeFilename(originalName) {
  const base = path.basename(originalName || "file");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned || "file";
}

export function s3Key({ workspaceId, documentId, versionNumber, filename }) {
  return `${s3EnvPrefix}/workspaces/${workspaceId}/documents/${documentId}/v/${versionNumber}/${safeFilename(filename)}`;
}

export async function putObject({ key, body, contentType }) {
  assertS3Configured();
  await s3.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
}

export async function headObject(key) {
  assertS3Configured();
  return s3.send(
    new HeadObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    })
  );
}

export async function getDownloadUrl(
  key,
  { filename, contentType, disposition = "inline", expiresIn = 300 } = {}
) {
  assertS3Configured();
  const safeName = filename ? safeFilename(filename) : undefined;
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ResponseContentType: contentType || undefined,
    ResponseContentDisposition: safeName
      ? `${disposition}; filename="${safeName}"`
      : disposition,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function deleteObject(key) {
  assertS3Configured();
  return s3.send(
    new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    })
  );
}

export async function copyObject({ sourceKey, targetKey }) {
  assertS3Configured();
  return s3.send(
    new CopyObjectCommand({
      Bucket: s3Bucket,
      CopySource: `${s3Bucket}/${sourceKey}`,
      Key: targetKey,
    })
  );
}

