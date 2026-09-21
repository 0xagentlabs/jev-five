import FightRoom from "./room";

export default async function FightRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <FightRoom roomId={roomId.toUpperCase()} />;
}
