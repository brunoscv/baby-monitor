import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Role } from './useDeviceRole';
import type { CameraEntry, CameraOnline, KnownCamera } from '../viewer/knownCameras';
import { GradientBackground } from '../shared/GradientBackground';
import { theme } from '../shared/theme';

type GridItem = CameraEntry | { roomId: '__add__' };

type Props = {
  currentRole?: Role | null;
  onChoose: (role: Role) => void;
  knownCameras?: CameraEntry[];
  onSelectCamera?: (cam: KnownCamera) => void;
  onAddCamera?: () => void;
  onRemoveCamera?: (roomId: string) => void;
};

export function SetupScreen({ currentRole, onChoose, knownCameras, onSelectCamera, onAddCamera, onRemoveCamera }: Props) {
  const gridData: GridItem[] = knownCameras ? [...knownCameras, { roomId: '__add__' }] : [];

  function notifyOffline() {
    Alert.alert(
      'Câmera indisponível',
      'Essa câmera está offline ou o código de acesso dela mudou. Toque e segure pra remover, ou escaneie um QR code novo.'
    );
  }

  function confirmRemove(roomId: string) {
    Alert.alert('Remover câmera?', `Remove "Câmera ${roomId.slice(0, 4)}" da lista. Você pode escaneá-la de novo depois.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => onRemoveCamera?.(roomId) },
    ]);
  }

  return (
    <View style={styles.screen}>
      <GradientBackground style={styles.header}>
        <Text style={styles.welcome}>👶 Bem-vindo</Text>
        <Text style={styles.title}>Baby Monitor{'\n'}Smart Câmera</Text>
        <Text style={styles.subtitle}>Configure como este aparelho vai ser usado</Text>
      </GradientBackground>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Pressable style={styles.card} onPress={() => onChoose('broadcaster')}>
          <View style={[styles.iconCircle, { backgroundColor: '#e6edff' }]}>
            <Ionicons name="videocam" size={26} color={theme.colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou a câmera</Text>
            <Text style={styles.cardDesc}>Este aparelho fica no quarto e transmite o vídeo</Text>
          </View>
          <Ionicons
            name={currentRole === 'broadcaster' ? 'checkmark-circle' : 'chevron-forward'}
            size={22}
            color={currentRole === 'broadcaster' ? theme.colors.success : theme.colors.textMuted}
          />
        </Pressable>

        <Pressable style={styles.card} onPress={() => onChoose('viewer')}>
          <View style={[styles.iconCircle, { backgroundColor: '#e7f9ee' }]}>
            <Ionicons name="phone-portrait" size={24} color={theme.colors.success} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Sou visualizador</Text>
            <Text style={styles.cardDesc}>Escaneie o QR code para acompanhar a câmera</Text>
          </View>
          <Ionicons
            name={currentRole === 'viewer' ? 'checkmark-circle' : 'chevron-forward'}
            size={22}
            color={currentRole === 'viewer' ? theme.colors.success : theme.colors.textMuted}
          />
        </Pressable>

        {knownCameras ? (
          <>
            <Text style={styles.sectionTitle}>Câmeras recentes</Text>
            <View style={styles.grid}>
              {gridData.map((item) =>
                !('online' in item) ? (
                  <Pressable key="__add__" style={styles.gridTile} onPress={onAddCamera}>
                    <Ionicons name="add" size={26} color={theme.colors.primary} />
                    <Text style={styles.gridLabel}>Nova</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    key={item.roomId}
                    style={styles.gridTile}
                    onLongPress={() => confirmRemove(item.roomId)}
                    onPress={() => (item.online === true ? onSelectCamera?.(item) : notifyOffline())}
                  >
                    <View style={[styles.gridDot, dotStyle(item.online)]} />
                    <Ionicons
                      name="videocam"
                      size={24}
                      color={item.online === true ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={styles.gridLabel} numberOfLines={1}>
                      Câmera {item.roomId.slice(0, 4)}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
            <Text style={styles.hint}>
              {knownCameras.length === 0
                ? 'Nenhuma câmera ainda — toque em "Nova" pra escanear um QR code.'
                : 'Toque numa câmera online pra assistir. Toque e segure pra remover.'}
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>
            Dica: dá pra conectar vários visualizadores (ex.: você e sua esposa) na mesma câmera depois, direto pelas
            opções da tela da câmera.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function dotStyle(online: CameraOnline) {
  if (online === 'checking') return { backgroundColor: theme.colors.textMuted };
  return { backgroundColor: online ? theme.colors.success : theme.colors.border };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 72, paddingBottom: 40, paddingHorizontal: 24, gap: 6 },
  welcome: { fontSize: 16, color: '#dbe4ff' },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', lineHeight: 36 },
  subtitle: { fontSize: 14, color: '#dbe4ff', marginTop: 6 },
  content: { flex: 1, marginTop: -20 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridTile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    shadowColor: '#1a1d29',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gridDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  gridLabel: { fontSize: 11, color: theme.colors.text, marginTop: 2, textAlign: 'center', paddingHorizontal: 4 },
});
