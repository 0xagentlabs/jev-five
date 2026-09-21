import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const newPlayerId = () => randomBytes(10).toString("hex");
export const newPlayerToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newRoomId = () => Array.from(randomBytes(8), (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("").slice(0, 8);

export function safeEqualHash(token: string, expected: string) {
  const actualBuffer = Buffer.from(hashToken(token), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
