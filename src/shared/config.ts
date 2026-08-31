// IP local da máquina que roda `server/` (mesma rede). Hoje é 192.168.100.108 (enp3s0) —
// é DHCP, pode mudar; confira com `ip -4 addr show` se parar de conectar.
export const SIGNALING_SERVER_URL = 'http://192.168.100.108:3001';
