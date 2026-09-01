import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export type Pairing = { roomId: string; token: string };

const KEY = 'broadcaster-pairing';

// Persistido pra sobreviver a reaberturas do app: sem isso, cada restart gerava
// um roomId novo e todas as câmeras salvas nos visualizadores morriam pra sempre.
export async function getOrCreatePairing(): Promise<Pairing> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  return regeneratePairing();
}

export async function regeneratePairing(): Promise<Pairing> {
  const fresh = { roomId: Crypto.randomUUID(), token: Crypto.randomUUID() };
  await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}
