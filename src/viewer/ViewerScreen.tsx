import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { io, Socket } from 'socket.io-client';
import { MediaStream, RTCPeerConnection, RTCView } from 'react-native-webrtc';
import { rtcConfig } from '../shared/webrtcConfig';

type PairingPayload = { serverUrl: string; roomId: string; token: string };
type Status = 'scanning' | 'permission-denied' | 'connecting' | 'connected' | 'ended' | 'invalid-qr' | 'join-error';

export function ViewerScreen() {
  const [status, setStatus] = useState<Status>('scanning');
  const [hasCamPermission, setHasCamPermission] = useState<boolean | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status: permStatus }) => {
      setHasCamPermission(permStatus === 'granted');
      if (permStatus !== 'granted') setStatus('permission-denied');
    });

    return () => {
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

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

  function connect(pairing: PairingPayload) {
    setStatus('connecting');
    const socket = io(pairing.serverUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { roomId: pairing.roomId, token: pairing.token });
    });

    socket.on('join-error', () => setStatus('join-error'));

    socket.on('webrtc-offer', async ({ sdp }: { sdp: any }) => {
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      pc.addEventListener('track', (event: any) => {
        setRemoteStream(event.streams[0]);
      });
      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { roomId: pairing.roomId, candidate: event.candidate });
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') setStatus('connected');
      });

      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { roomId: pairing.roomId, sdp: answer });
    });

    socket.on('ice-candidate', async ({ candidate }: { candidate: any }) => {
      await pcRef.current?.addIceCandidate(candidate);
    });

    socket.on('broadcaster-left', () => {
      pcRef.current?.close();
      pcRef.current = null;
      setRemoteStream(null);
      setStatus('ended');
    });
  }

  if (status === 'connected' && remoteStream) {
    return <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />;
  }

  if (status === 'scanning' && hasCamPermission) {
    return (
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />
    );
  }

  const canRetry = status === 'invalid-qr' || status === 'join-error' || status === 'ended';

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{statusLabel(status)}</Text>
      {canRetry && (
        <Pressable style={styles.retryButton} onPress={() => { scannedRef.current = false; setStatus('scanning'); }}>
          <Text style={styles.retryText}>Escanear novamente</Text>
        </Pressable>
      )}
    </View>
  );
}

function statusLabel(status: Status) {
  switch (status) {
    case 'permission-denied':
      return 'Permissão de câmera negada';
    case 'connecting':
      return 'Conectando à câmera...';
    case 'ended':
      return 'A câmera encerrou a transmissão';
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
  status: { color: '#fff', fontSize: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
