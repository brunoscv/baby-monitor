import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from './useDeviceRole';

export function SetupScreen({ onChoose }: { onChoose: (role: Role) => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Como esse aparelho vai ser usado?</Text>
      <Pressable style={styles.button} onPress={() => onChoose('broadcaster')}>
        <Text style={styles.buttonText}>Sou a câmera</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => onChoose('viewer')}>
        <Text style={styles.buttonText}>Sou visualizador</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 18, marginBottom: 8, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
