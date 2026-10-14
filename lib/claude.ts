import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "./errors";

let client: Anthropic | null = null;

export const MODEL = "claude-haiku-5-5";

export function getClaude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "Server is missing ANTHROPIC_API_KEY");
  }
  client ??= new Anthropic();
  return client;
}
