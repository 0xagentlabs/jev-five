import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { FightingError, FightingRoom } from "./fighting";

const roomPath = (id: string) => `fighting/rooms/${id}.json`;

function storageReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).json() as Promise<FightingRoom>;
}

export async function getRoom(id: string): Promise<{ room: FightingRoom; etag: string } | null> {
  if (!storageReady()) throw new FightingError("STORAGE_NOT_CONFIGURED", "Jev Fighting 房间存储尚未配置。", 503);
  const result = await get(roomPath(id), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const etag = (result.headers.get("etag") ?? "").replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!etag) throw new FightingError("STORAGE_ETAG_MISSING", "房间存储缺少版本标识。", 503);
  return { room: await readStream(result.stream), etag };
}

export async function createRoom(room: FightingRoom) {
  if (!storageReady()) throw new FightingError("STORAGE_NOT_CONFIGURED", "Jev Fighting 房间存储尚未配置。", 503);
  try {
    await put(roomPath(room.id), JSON.stringify(room), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new FightingError("ROOM_EXISTS", "房间码冲突，请重试。", 409);
    throw error;
  }
}

export async function updateRoom(id: string, mutate: (room: FightingRoom) => FightingRoom): Promise<FightingRoom> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await getRoom(id);
    if (!current) throw new FightingError("ROOM_NOT_FOUND", "房间不存在或已过期。", 404);
    if (Date.parse(current.room.expiresAt) < Date.now()) throw new FightingError("ROOM_EXPIRED", "房间已经过期。", 410);
    const next = mutate(current.room);
    try {
      await put(roomPath(id), JSON.stringify(next), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: current.etag,
        contentType: "application/json",
        cacheControlMaxAge: 0,
      });
      return next;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) continue;
      throw error;
    }
  }
  throw new FightingError("ROOM_BUSY", "房间刚刚发生变化，请重试。", 409);
}
