const baseUrl = process.env.FIGHTING_BASE_URL ?? "http://localhost:3000";

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${data.message ?? path}`);
  return data;
}

const jsonPost = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const created = await request("/api/fighting/rooms", jsonPost({ name: "API verification", hostName: "Alpha", hostSeat: "black", turnSeconds: 60, allowSpectators: true }));
const roomPath = `/api/fighting/rooms/${created.room.id}`;
const joined = await request(roomPath, jsonPost({ action: "join", name: "Beta", seat: "white" }));
await request(roomPath, jsonPost({ action: "configure", token: created.player.token, engineName: "Alpha Jev", persona: "attack" }));
await request(roomPath, jsonPost({ action: "configure", token: joined.player.token, engineName: "Beta Jev", persona: "defense" }));
await request(roomPath, jsonPost({ action: "start", token: created.player.token }));
const moved = await request(roomPath, jsonPost({ action: "move", token: created.player.token, move: { row: 7, col: 7 }, confidence: 0.88, latencyMs: 42 }));
const read = await request(roomPath);

if (moved.room.moves.length !== 1 || read.room.turn !== "white" || "tokenHash" in read.room.players.black) {
  throw new Error("Room state or public redaction verification failed");
}

console.log(`Jev Fighting verified: room ${created.room.id}, two players, one legal move, private tokens redacted.`);
