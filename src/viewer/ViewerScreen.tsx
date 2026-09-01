import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { io, Socket } from 'socket.io-client';
import { MediaStream, RTCPeerConnection, RTCView } from 'react-native-webrtc';
import { rtcConfig } from '../shared/webrtcConfig';
import { theme } from '../shared/theme';
import type { Role } from '../setup/useDeviceRole';
import { SetupScreen } from '../setup/SetupScreen';
import { CameraEntry, getKnownCameras, KnownCamera, removeKnownCamera, saveKnownCamera } from './knownCameras';

type PairingPayload = { serverUrl: string; roomId: string; token: string };
type Status = 'home' | 'scanning' | 'permission-denied' | 'connecting' | 'connected' | 'ended' | 'invalid-qr' | 'join-error' | 'kicked';

export function ViewerScreen({ onChooseRole }: { onChooseRole: (role: Role) => void }) {
  const [status, setStatus] = useState<Status>('home');
  const [hasCamPermission, setHasCamPermission] = useState<boolean | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [knownCameras, setKnownCameras] = useState<CameraEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status: permStatus }) => {
      setHasCamPermission(permStatus === 'granted');
    });

    return () => {
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (status !== 'home') return;
    let cancelled = false;
    getKnownCameras().then((cams) => {
      if (cancelled) return;
      setKnownCameras(cams.map((c) => ({ ...c, online: 'checking' })));
      cams.forEach(checkCameraStatus);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function checkCameraStatus(cam: KnownCamera) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${cam.serverUrl}/rooms/${cam.roomId}/status`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setKnownCameras((prev) => prev.map((c) => (c.roomId === cam.roomId ? { ...c, online: !!data.online } : c)));
    } catch {
      setKnownCameras((prev) => prev.map((c) => (c.roomId === cam.roomId ? { ...c, online: false } : c)));
    }
  }

  function goHome() {
    pcRef.current?.close();
    pcRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    scannedRef.current = false;
    setRemoteStream(null);
    setStatus('home');
  }

  function startScanning() {
    if (hasCamPermission) {
      scannedRef.current = false;
      setStatus('scanning');
      return;
    }
    Camera.requestCameraPermissionsAsync().then(({ status: permStatus }) => {
      setHasCamPermission(permStatus === 'granted');
      setStatus(permStatus === 'granted' ? 'scanning' : 'permission-denied');
    });
  }

  function handleScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;

    let pairing: PairingPayload;
    try {
      pairing = JSON.parse(data);
      if (!pairing.serverUrl || !pairing.roomId || !pairing.token) throw new Error('campos ausentes');
    } catch (err) {
      console.error('QR inválido', err);
      setStatus('invalid-qr');
      return;
    }

    connect(pairing);
  }

  function connectToKnown(cam: KnownCamera) {
    scannedRef.current = true;
    connect(cam);
  }

  function removeCamera(roomId: string) {
    removeKnownCamera(roomId);
    setKnownCameras((prev) => prev.filter((c) => c.roomId !== roomId));
  }

  function connect(pairing: PairingPayload) {
    setStatus('connecting');
    const socket = io(pairing.serverUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { roomId: pairing.roomId, token: pairing.token });
    });

    socket.on('connect_error', (err) => {
      console.error('signaling connect_error', err.message);
      setStatus('join-error');
    });

    socket.on('join-error', () => setStatus('join-error'));

    socket.on('webrtc-offer', async ({ sdp, fromId }: { sdp: any; fromId: string }) => {
      broadcasterIdRef.current = fromId;
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      pc.addEventListener('track', (event: any) => {
        setRemoteStream(event.streams[0]);
      });
      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { targetId: fromId, candidate: event.candidate });
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
          setStatus('connected');
          saveKnownCamera({ roomId: pairing.roomId, token: pairing.token, serverUrl: pairing.serverUrl });
        }
      });

      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: fromId, sdp: answer });
    });

    socket.on('ice-candidate', async ({ candidate }: { candidate: any }) => {
      await pcRef.current?.addIceCandidate(candidate);
    });

    socket.on('broadcaster-left', () => {
      pcRef.current?.close();
      pcRef.current = null;
      socket.disconnect();
      setRemoteStream(null);
      setStatus('ended');
    });

    socket.on('kicked', () => {
      pcRef.current?.close();
      pcRef.current = null;
      socket.disconnect();
      setRemoteStream(null);
      setStatus('kicked');
    });
  }

  if (status === 'connected' && remoteStream) {
    return (
      <View style={styles.videoContainer}>
        <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
        <Pressable style={styles.endButton} onPress={goHome}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  if (status === 'home') {
    return (
      <SetupScreen
        currentRole="viewer"
        onChoose={onChooseRole}
        knownCameras={knownCameras}
        onSelectCamera={connectToKnown}
        onAddCamera={startScanning}
        onRemoveCamera={removeCamera}
      />
    );
  }

  if (status === 'scanning' && hasCamPermission) {
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScanned}
        />
        <View style={styles.scanHeader}>
          <Ionicons name="qr-code-outline" size={22} color="#fff" />
          <Text style={styles.scanHeaderText}>Aponte para o QR code da câmera</Text>
        </View>
        <Pressable style={styles.backButton} onPress={goHome}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const canRetry = status === 'invalid-qr' || status === 'join-error' || status === 'ended' || status === 'kicked';

  return (
    <View style={styles.container}>
      <Ionicons name={statusIcon(status)} size={40} color={theme.colors.primaryLight} />
      <Text style={styles.status}>{statusLabel(status)}</Text>
      {canRetry && (
        <Pressable style={styles.retryButton} onPress={startScanning}>
          <Text style={styles.retryText}>Escanear novamente</Text>
        </Pressable>
      )}
      <Pressable onPress={goHome}>
        <Text style={styles.changeRoleText}>Voltar para câmeras</Text>
      </Pressable>
    </View>
  );
}

function statusIcon(status: Status): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'permission-denied':
      return 'lock-closed';
    case 'connecting':
      return 'sync';
    case 'ended':
    case 'kicked':
      return 'videocam-off';
    case 'invalid-qr':
    case 'join-error':
      return 'alert-circle';
    default:
      return 'hourglass';
  }
}

function statusLabel(status: Status) {
  switch (status) {
    case 'permission-denied':
      return 'Permissão de câmera negada';
    case 'connecting':
      return 'Conectando à câmera...';
    case 'ended':
      return 'A câmera encerrou a transmissão';
    case 'kicked':
      return 'O acesso a esta câmera foi removido';
    case 'invalid-qr':
      return 'QR code inválido, tente novamente';
    case 'join-error':
      return 'Não foi possível entrar na sala (QR expirado?)';
    default:
      return 'Carregando...';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 24, gap: 16 },
  videoContainer: { flex: 1, backgroundColor: '#000' },
  status: { color: '#fff', fontSize: 16, textAlign: 'center' },
  retryButton: { backgroundColor: theme.colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: theme.radius.md },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scanHeader: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00000099',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
  },
  scanHeaderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeRoleText: { color: theme.colors.textMuted, fontSize: 13, marginTop: 8, textDecorationLine: 'underline' },
  endButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00000099',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
