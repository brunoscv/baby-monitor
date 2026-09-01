import AsyncStorage from '@react-native-async-storage/async-storage';

export type KnownCamera = { roomId: string; token: string; serverUrl: string; savedAt: number };
export type CameraOnline = boolean | 'checking';
export type CameraEntry = KnownCamera & { online: CameraOnline };

const KEY = 'known-cameras';
const MAX_CAMERAS = 10;

export async function getKnownCameras(): Promise<KnownCamera[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveKnownCamera(cam: Omit<KnownCamera, 'savedAt'>) {
  const list = await getKnownCameras();
  const next = [{ ...cam, savedAt: Date.now() }, ...list.filter((c) => c.roomId !== cam.roomId)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX_CAMERAS)));
}

export async function removeKnownCamera(roomId: string) {
  const list = await getKnownCameras();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((c) => c.roomId !== roomId)));
}
