import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Role = 'broadcaster' | 'viewer';

const ROLE_KEY = 'device-role';

export function useDeviceRole() {
  // undefined = ainda carregando do storage, null = nenhum papel escolhido ainda
  const [role, setRole] = useState<Role | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_KEY).then((stored) => {
      setRole(stored === 'broadcaster' || stored === 'viewer' ? stored : null);
    });
  }, []);

  async function chooseRole(next: Role) {
    await AsyncStorage.setItem(ROLE_KEY, next);
    setRole(next);
  }

  async function resetRole() {
    await AsyncStorage.removeItem(ROLE_KEY);
    setRole(null);
  }

  return { role, chooseRole, resetRole };
}
