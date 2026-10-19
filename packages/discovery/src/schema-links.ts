import { z } from "zod";

// Display links are checked independently from the DNS/policy fetch boundary.
export const publicLinkSchema = z
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port &&
      hostname.includes(".") &&
      !hostname.endsWith(".") &&
      !/^[\d.]+$/.test(hostname) &&
      !hostname.includes(":") &&
      !/\.(?:localhost|local|internal|home\.arpa)$/.test(hostname)
    );
  }, "Expected an unauthenticated public HTTP link");
export const evidenceSchema = z.strictObject({
  url: publicLinkSchema,
  quote: z.string().trim().min(1).max(4000),
  selector: z.string().trim().min(1).max(1000),
});
