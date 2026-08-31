import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as Crypto from 'expo-crypto';
import QRCode from 'react-native-qrcode-svg';
import { io, Socket } from 'socket.io-client';
import { mediaDevices, MediaStream, RTCPeerConnection, RTCView } from 'react-native-webrtc';
import { SIGNALING_SERVER_URL } from '../shared/config';
import { mediaConstraints, rtcConfig } from '../shared/webrtcConfig';
import { theme } from '../shared/theme';

type Status = 'starting-camera' | 'ready' | 'permission-denied' | 'error';
type ViewerConn = 'connecting' | 'connected' | 'disconnected';
type Viewer = { id: string; status: ViewerConn; joinedAt: number };

export function BroadcasterScreen() {
  useKeepAwake();
  const [status, setStatus] = useState<Status>('starting-camera');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [pairing] = useState(() => ({ roomId: Crypto.randomUUID(), token: Crypto.randomUUID() }));
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      if (cam.status !== 'granted' || mic.status !== 'granted') {
        setStatus('permission-denied');
        return;
      }

      try {
        const stream = (await mediaDevices.getUserMedia(mediaConstraints)) as unknown as MediaStream;
        streamRef.current = stream;
        setLocalStream(stream);
        setStatus('ready');
        startSignaling(stream);
      } catch (err) {
        console.error('getUserMedia falhou', err);
        setStatus('error');
      }
    })();

    return () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      socketRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function startSignaling(stream: MediaStream) {
    const socket = io(SIGNALING_SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('create-room', pairing);
    });

    socket.on('viewer-joined', async ({ viewerId }: { viewerId: string }) => {
      setViewers((prev) => [...prev.filter((v) => v.id !== viewerId), { id: viewerId, status: 'connecting', joinedAt: Date.now() }]);

      const pc = new RTCPeerConnection(rtcConfig);
      pcsRef.current.set(viewerId, pc);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { targetId: viewerId, candidate: event.candidate });
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') updateViewerStatus(viewerId, 'connected');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          updateViewerStatus(viewerId, 'disconnected');
        }
      });

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { targetId: viewerId, sdp: offer });
    });

    socket.on('webrtc-answer', async ({ sdp, fromId }: { sdp: any; fromId: string }) => {
      await pcsRef.current.get(fromId)?.setRemoteDescription(sdp);
    });

    socket.on('ice-candidate', async ({ candidate, fromId }: { candidate: any; fromId: string }) => {
      await pcsRef.current.get(fromId)?.addIceCandidate(candidate);
    });

    socket.on('viewer-left', ({ viewerId }: { viewerId: string }) => {
      pcsRef.current.get(viewerId)?.close();
      pcsRef.current.delete(viewerId);
      setViewers((prev) => prev.filter((v) => v.id !== viewerId));
    });
  }

  function updateViewerStatus(id: string, viewerStatus: ViewerConn) {
    setViewers((prev) => prev.map((v) => (v.id === id ? { ...v, status: viewerStatus } : v)));
  }

  function removeViewer(id: string) {
    socketRef.current?.emit('kick-viewer', { roomId: pairing.roomId, viewerId: id });
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    setViewers((prev) => prev.filter((v) => v.id !== id));
  }

  const pairingPayload = JSON.stringify({
    serverUrl: SIGNALING_SERVER_URL,
    roomId: pairing.roomId,
    token: pairing.token,
  });

  const connectedCount = viewers.filter((v) => v.status === 'connected').length;

  return (
    <View style={styles.container}>
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      )}

      <View style={styles.topBar}>
        <View style={styles.badge}>
          <View style={[styles.dot, { backgroundColor: connectedCount > 0 ? theme.colors.success : theme.colors.warning }]} />
          <Text style={styles.badgeText}>{statusLabel(status, connectedCount)}</Text>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={() => {
            setShowQr(viewers.length === 0);
            setOptionsOpen(true);
          }}
        >
          <Ionicons name="options" size={22} color="#fff" />
        </Pressable>
      </View>

      <Modal visible={optionsOpen} animationType="slide" transparent onRequestClose={() => setOptionsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Opções da câmera</Text>

            <Pressable style={styles.sheetAction} onPress={() => setShowQr((s) => !s)}>
              <Ionicons name="qr-code" size={20} color={theme.colors.primary} />
              <Text style={styles.sheetActionText}>{showQr ? 'Ocultar QR code' : 'Conectar outro celular'}</Text>
              <Ionicons name={showQr ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
            </Pressable>

            {showQr && (
              <View style={styles.qrCard}>
                <QRCode value={pairingPayload} size={200} />
                <Text style={styles.qrHint}>Escaneie com o app no celular do visualizador (ex.: o da sua esposa) para liberar o acesso à câmera.</Text>
              </View>
            )}

            <Text style={styles.sheetSubtitle}>Dispositivos conectados ({viewers.length})</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {viewers.length === 0 && <Text style={styles.emptyText}>Nenhum visualizador conectado ainda.</Text>}
              {viewers.map((v) => (
                <View key={v.id} style={styles.viewerRow}>
                  <View style={[styles.dot, { backgroundColor: v.status === 'connected' ? theme.colors.success : theme.colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.viewerId}>Visualizador {v.id.slice(0, 6)}</Text>
                    <Text style={styles.viewerStatus}>{v.status === 'connected' ? 'Conectado' : v.status === 'connecting' ? 'Conectando...' : 'Desconectado'}</Text>
                  </View>
                  <Pressable style={styles.revokeButton} onPress={() => removeViewer(v.id)}>
                    <Ionicons name="close-circle" size={22} color={theme.colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Pressable style={styles.closeButton} onPress={() => setOptionsOpen(false)}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {status !== 'ready' && (
        <View style={styles.centerOverlay}>
          <Text style={styles.centerText}>{statusLabel(status, connectedCount)}</Text>
        </View>
      )}
    </View>
  );
}

function statusLabel(status: Status, connectedCount: number) {
  switch (status) {
    case 'starting-camera':
      return 'Abrindo câmera...';
    case 'permission-denied':
      return 'Permissão de câmera/microfone negada';
    case 'error':
      return 'Erro ao abrir a câmera';
    case 'ready':
      return connectedCount > 0 ? `${connectedCount} visualizador(es) conectado(s)` : 'Aguardando visualizador';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00000099',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  centerText: { color: '#fff', fontSize: 16, backgroundColor: '#00000099', padding: 8, borderRadius: 8 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  sheetSubtitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted, marginTop: 4 },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.background,
    padding: 14,
    borderRadius: theme.radius.md,
  },
  sheetActionText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
  qrCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: theme.radius.md,
  },
  qrHint: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 8 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 8 },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  viewerId: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  viewerStatus: { fontSize: 12, color: theme.colors.textMuted },
  revokeButton: { padding: 4 },
  closeButton: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
