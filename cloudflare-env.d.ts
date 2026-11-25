declare namespace Cloudflare {
  interface Env {
    PERSONAL_ACCOUNTS?: DurableObjectNamespace;
    ACCOUNT_LIMIT?: RateLimit;
    OWNER_PASSWORD?: string;
    SERVICE_TOKEN?: string;
    HEALTH_PROVIDER?: string;
    HEALTH_FEED_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GARMIN_PERSONAL_API_KEY?: string;
    GARMIN_CONNECTION_ENCRYPTION_KEY?: string;
    OPENAI_API_KEY?: string;
  }
}
