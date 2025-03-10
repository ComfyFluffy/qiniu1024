import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.preprocess(
      // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
      // Since NextAuth.js automatically uses the VERCEL_URL if present.
      (str) => process.env.VERCEL_URL ?? str,
      // VERCEL_URL doesn't include `https` so it cant be validated as a URL
      process.env.VERCEL ? z.string() : z.string().url(),
    ),

    // GORSE
    GORSE_URL: z.string().url(),

    // REIDS
    REDIS_URL: z.string().url(),

    // elasticsearch
    ES_URL: z.string().url(),

    ALIYUN_ACCESS_KEY_ID: z.string(),
    ALIYUN_ACCESS_KEY_SECRET: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_ALIYUN_OSS_BUCKET: z.string(),
    NEXT_PUBLIC_ALIYUN_OSS_REGION: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GORSE_URL: process.env.GORSE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ES_URL: process.env.ES_URL,
    ALIYUN_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID,
    ALIYUN_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET,
    NEXT_PUBLIC_ALIYUN_OSS_BUCKET: process.env.NEXT_PUBLIC_ALIYUN_OSS_BUCKET,
    NEXT_PUBLIC_ALIYUN_OSS_REGION: process.env.NEXT_PUBLIC_ALIYUN_OSS_REGION,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
