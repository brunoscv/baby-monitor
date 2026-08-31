// IP local da máquina que roda `server/` (mesma rede). Hoje é 192.168.100.49 (en0) —
// é DHCP, pode mudar; confira com `ipconfig getifaddr en0` se parar de conectar.
export const SIGNALING_SERVER_URL = 'http://192.168.100.49:3001';
