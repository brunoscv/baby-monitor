import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Role } from './useDeviceRole';
import { GradientBackground } from '../shared/GradientBackground';
import { theme } from '../shared/theme';

export function SetupScreen({ onChoose }: { onChoose: (role: Role) => void }) {
  return (
    <View style={styles.screen}>
      <GradientBackground style={styles.header}>
        <Text style={styles.welcome}>👶 Bem-vindo</Text>
        <Text style={styles.title}>Baby Monitor{'\n'}Smart Câmera</Text>
        <Text style={styles.subtitle}>Configure como este aparelho vai ser usado</Text>
      </GradientBackground>

      <View style={styles.content}>
        <Pressable style={styles.card} onPress={() => onChoose('broadcaster')}>
          <View style={[styles.iconCircle, { backgroundColor: '#e6edff' }]}>
            <Ionicons name="videocam" size={26} color={theme.colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou a câmera</Text>
            <Text style={styles.cardDesc}>Este aparelho fica no quarto e transmite o vídeo</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => onChoose('viewer')}>
          <View style={[styles.iconCircle, { backgroundColor: '#e7f9ee' }]}>
            <Ionicons name="phone-portrait" size={24} color={theme.colors.success} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou visualizador</Text>
            <Text style={styles.cardDesc}>Escaneie o QR code para acompanhar a câmera</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
        </Pressable>

        <Text style={styles.hint}>Dica: dá pra conectar vários visualizadores (ex.: você e sua esposa) na mesma câmera depois, direto pelas opções da tela da câmera.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 72, paddingBottom: 40, paddingHorizontal: 24, gap: 6 },
  welcome: { fontSize: 16, color: '#dbe4ff' },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', lineHeight: 36 },
  subtitle: { fontSize: 14, color: '#dbe4ff', marginTop: 6 },
  content: { flex: 1, marginTop: -20, paddingHorizontal: 20, gap: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 18,
    shadowColor: '#1a1d29',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  cardDesc: { fontSize: 13, color: theme.colors.textMuted },
  hint: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 12, lineHeight: 18 },
});
