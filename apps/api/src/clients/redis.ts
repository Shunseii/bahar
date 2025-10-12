import { Redis } from "@upstash/redis";
import { config } from "../utils/config";

export const redisClient = new Redis({
  automaticDeserialization: true,
  url: config.UPSTASH_REDIS_REST_URL,
  token: config.UPSTASH_REDIS_REST_TOKEN,
});
