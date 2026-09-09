import App from '@/components/App';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <App initialRoomName={decodeURIComponent(params.roomId)} />;
}
