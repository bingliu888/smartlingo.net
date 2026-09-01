export const R2_DELETE_BATCH_SIZE = 500;

export type R2DeleteBucket = {
  delete(keys: string | string[]): Promise<unknown>;
};

export type R2ListBucket = R2DeleteBucket & {
  list(options:{prefix:string;cursor?:string;limit?:number}):Promise<{
    objects:Array<{key:string}>;
    truncated?:boolean;
    cursor?:string;
  }>;
};

export type R2MultipartBucket = {
  resumeMultipartUpload(key: string, uploadId: string): { abort(): Promise<void> };
};

type R2MultipartError = {
  code?: unknown;
  name?: unknown;
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

function missingMultipartUpload(error: unknown) {
  const issue = (error && typeof error === "object" ? error : {}) as R2MultipartError;
  if (issue.status === 404 || issue.statusCode === 404) return true;
  if (issue.code === "NoSuchUpload" || issue.name === "NoSuchUpload") return true;
  const message = typeof issue.message === "string" ? issue.message : "";
  return /\bNoSuchUpload\b/i.test(message)
    || /multipart upload.{0,80}(?:not found|does not exist)/i.test(message);
}

export async function abortR2MultipartUploadIdempotently(
  bucket: R2MultipartBucket,
  key: string,
  uploadId: string,
) {
  try {
    await bucket.resumeMultipartUpload(key, uploadId).abort();
  } catch (error) {
    // A previous retry can already have aborted the upload, or the upload can
    // have completed before deletion began. Both mean there is no multipart
    // state left to clean. Authentication/storage errors must still retry.
    if (!missingMultipartUpload(error)) throw error;
  }
}

export async function deleteR2KeysInBatches(
  bucket: R2DeleteBucket,
  keys: readonly string[],
) {
  for (let offset = 0; offset < keys.length; offset += R2_DELETE_BATCH_SIZE) {
    await bucket.delete(keys.slice(offset, offset + R2_DELETE_BATCH_SIZE));
  }
}

export async function deleteR2PrefixInBatches(
  bucket:R2ListBucket,
  prefix:string,
){
  let deleted=0;
  let cursor:string|undefined;
  do{
    const page=await bucket.list({prefix,cursor,limit:1000});
    const keys=(page.objects||[])
      .map(object=>object.key)
      .filter(key=>key.startsWith(prefix));
    await deleteR2KeysInBatches(bucket,keys);
    deleted+=keys.length;
    if(page.truncated&&!page.cursor)throw new Error("R2_PREFIX_CURSOR_MISSING");
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  return deleted;
}

// Deletion sagas intentionally consume one R2 page per invocation.  A page
// containing objects is never treated as final even when R2 says untruncated:
// the following invocation must observe an empty page before quota is released.
export async function deleteOneR2PrefixPage(
  bucket:R2ListBucket,
  prefix:string,
  limit=1000,
){
  const bounded=Math.max(1,Math.min(1000,Math.floor(limit)));
  const page=await bucket.list({prefix,limit:bounded});
  const objects=page.objects||[];
  const keys=objects.map(object=>object.key);
  if(keys.some(key=>!key.startsWith(prefix)))throw new Error("R2_PREFIX_SCOPE_MISMATCH");
  await deleteR2KeysInBatches(bucket,keys);
  if(page.truncated&&!page.cursor)throw new Error("R2_PREFIX_CURSOR_MISSING");
  return {deleted:keys.length,empty:keys.length===0&&!page.truncated};
}
