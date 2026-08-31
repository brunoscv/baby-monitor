import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as Crypto from 'expo-crypto';
import QRCode from 'react-native-qrcode-svg';
import { io, Socket } from 'socket.io-client';
import { mediaDevices, MediaStream, RTCPeerConnection, RTCView } from 'react-native-webrtc';
import { SIGNALING_SERVER_URL } from '../shared/config';
import { mediaConstraints, rtcConfig } from '../shared/webrtcConfig';

type Status = 'starting-camera' | 'waiting-viewer' | 'connecting' | 'connected' | 'permission-denied' | 'error';

export function BroadcasterScreen() {
  useKeepAwake();
  const [status, setStatus] = useState<Status>('starting-camera');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [pairing] = useState(() => ({ roomId: Crypto.randomUUID(), token: Crypto.randomUUID() }));
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;

    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      if (cam.status !== 'granted' || mic.status !== 'granted') {
        setStatus('permission-denied');
        return;
      }

      try {
        stream = (await mediaDevices.getUserMedia(mediaConstraints)) as unknown as MediaStream;
        setLocalStream(stream);
        startSignaling(stream);
      } catch (err) {
        console.error('getUserMedia falhou', err);
        setStatus('error');
      }
    })();

    return () => {
      pcRef.current?.close();
      socketRef.current?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function startSignaling(stream: MediaStream) {
    const socket = io(SIGNALING_SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('create-room', pairing);
      setStatus('waiting-viewer');
    });

    socket.on('viewer-joined', async () => {
      setStatus('connecting');
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { roomId: pairing.roomId, candidate: event.candidate });
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') setStatus('connected');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatus('waiting-viewer');
        }
      });

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { roomId: pairing.roomId, sdp: offer });
    });

    socket.on('webrtc-answer', async ({ sdp }: { sdp: any }) => {
      await pcRef.current?.setRemoteDescription(sdp);
    });

    socket.on('ice-candidate', async ({ candidate }: { candidate: any }) => {
      await pcRef.current?.addIceCandidate(candidate);
    });

    socket.on('viewer-left', () => {
      pcRef.current?.close();
      pcRef.current = null;
      setStatus('waiting-viewer');
    });
  }

  const pairingPayload = JSON.stringify({
    serverUrl: SIGNALING_SERVER_URL,
    roomId: pairing.roomId,
    token: pairing.token,
  });

  return (
    <View style={styles.container}>
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      )}
      <View style={styles.overlay}>
        <Text style={styles.status}>{statusLabel(status)}</Text>
        {status === 'waiting-viewer' && (
          <View style={styles.qrBox}>
            <QRCode value={pairingPayload} size={220} />
          </View>
        )}
      </View>
    </View>
  );
}

function statusLabel(status: Status) {
  switch (status) {
    case 'starting-camera':
      return 'Abrindo câmera...';
    case 'permission-denied':
      return 'Permissão de câmera/microfone negada';
    case 'waiting-viewer':
      return 'Aguardando visualizador — escaneie o QR code';
    case 'connecting':
      return 'Conectando...';
    case 'connected':
      return 'Conectado';
    case 'error':
      return 'Erro ao abrir a câmera';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 16 },
  status: { color: '#fff', fontSize: 16, backgroundColor: '#00000099', padding: 8, borderRadius: 8 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
});
