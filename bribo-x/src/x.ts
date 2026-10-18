import { ApiResponseError, TwitterApi, type TwitterApiReadWrite } from "twitter-api-v2";

export type Mention = {
  id: string; text: string; author_id: string; author: string; author_bio: string;
  like_count: number; conversation_id: string; is_retweet: boolean;
};
export type XErrorKind = "credits" | "auth" | "duplicate" | "rate_limit" | "other";

export class XError extends Error {
  constructor(public kind: XErrorKind, message: string) {
    super(message);
  }
}

export function classifyXError(status: number, detail: string): XErrorKind {
  if (status === 402) return "credits";
  if (status === 429) return "rate_limit";
  if (status === 403 && /duplicate/i.test(detail)) return "duplicate";
  if (status === 401 || status === 403) return "auth";
  return "other";
}

export interface XClient {
  me(): Promise<{ id: string; username: string }>;
  post(text: string, replyToId?: string): Promise<string>;
  mentions(userId: string, sinceId: string | null): Promise<Mention[]>;
}

const SECRETS = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"] as const;

function wrap(e: unknown): never {
  if (e instanceof ApiResponseError) {
    const detail = JSON.stringify(e.data ?? {});
    throw new XError(classifyXError(e.code, detail), `X API ${e.code}: ${detail.slice(0, 300)}`);
  }
  throw e;
}

export class TwitterXClient implements XClient {
  private rw: TwitterApiReadWrite;

  constructor(env: Record<string, string | undefined>) {
    for (const k of SECRETS) if (!env[k]) throw new Error(`Missing secret ${k}`);
    this.rw = new TwitterApi({
      appKey: env.X_API_KEY!, appSecret: env.X_API_SECRET!,
      accessToken: env.X_ACCESS_TOKEN!, accessSecret: env.X_ACCESS_SECRET!,
    }).readWrite;
  }

  async me() {
    try {
      const { data } = await this.rw.v2.me();
      return { id: data.id, username: data.username };
    } catch (e) { return wrap(e); }
  }

  async post(text: string, replyToId?: string) {
    try {
      const { data } = await this.rw.v2.tweet(text, replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : undefined);
      return data.id;
    } catch (e) { return wrap(e); }
  }

  async mentions(userId: string, sinceId: string | null): Promise<Mention[]> {
    try {
      const page = await this.rw.v2.userMentionTimeline(userId, {
        max_results: 25,
        ...(sinceId ? { since_id: sinceId } : {}),
        expansions: ["author_id"],
        "tweet.fields": ["public_metrics", "conversation_id", "referenced_tweets", "author_id"],
        "user.fields": ["description", "username"],
      });
      return page.tweets.map((t) => {
        const user = page.includes.author(t);
        return {
          id: t.id,
          text: t.text,
          author_id: t.author_id ?? "",
          author: user?.username ?? "",
          author_bio: user?.description ?? "",
          like_count: t.public_metrics?.like_count ?? 0,
          conversation_id: t.conversation_id ?? t.id,
          is_retweet: (t.referenced_tweets ?? []).some((r) => r.type === "retweeted"),
        };
      });
    } catch (e) { return wrap(e); }
  }
}
