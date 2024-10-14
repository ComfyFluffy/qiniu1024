import OSS from "ali-oss";
import { env } from "~/env.mjs";

const client = new OSS({
  region: env.NEXT_PUBLIC_ALIYUN_OSS_REGION,
  accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: env.NEXT_PUBLIC_ALIYUN_OSS_BUCKET,
});

export interface UploadParameters {
  OSSAccessKeyId: string;
  policy: string;
  Signature: string;
  key: string;
}

export const createUploadParameters = (keyPrefix: string) => {
  const key = `${keyPrefix}/${Date.now()}`;
  const policy = {
    expiration: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour expiration
    conditions: [
      ["content-length-range", 0, 1048576000], // 1GB max size
      ["starts-with", "$key", keyPrefix],
    ],
  };

  const formData = client.calculatePostSignature(policy);

  return {
    OSSAccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    policy: formData.policy,
    Signature: formData.Signature,
    key,
  };
};
