# Opções de TURN e signaling server (fora do Wi-Fi / 4G-5G)

Contexto: hoje o app só funciona com broadcaster e viewer na mesma rede Wi-Fi,
porque (1) o signaling server roda local no Mac (`server/index.js`, IP tipo
`192.168.x.x`) e (2) só existe STUN configurado (`src/shared/webrtcConfig.ts`),
sem TURN — então qualquer rede com CGNAT (ex.: a nossa própria operadora) não
consegue estabelecer a conexão P2P do WebRTC.

Este documento existe pra registrar as opções levantadas, sem compromisso —
a ideia é prototipar as 3 e decidir na prática qual usar. Nenhuma foi
implementada ainda.

---

## Opção 1 — Cloudflare Workers (signaling) + Metered Open Relay (TURN)

**Signaling**: reescrever `server/index.js` como um Cloudflare Worker usando
**Durable Objects** (uma instância de DO por `roomId`), com WebSocket puro via
a *Hibernation WebSocket API*. Socket.IO como está hoje **não roda** em
Workers (depende do modelo de `http.Server` do Node com long-polling/sticky
session, que não existe no runtime de Workers) — então isso implica trocar
`socket.io-client` por `WebSocket` nativo no app (Broadcaster/Viewer),
mantendo o mesmo protocolo de eventos (`create-room`, `join-room`,
`webrtc-offer/answer`, `ice-candidate`, `viewer-joined/left`, `kick-viewer`,
`kicked`).

**TURN**: [Metered Open Relay](https://www.metered.ca/tools/openrelay/) —
requer conta grátis + API key. Free tier: **20 GB de relay/mês**. Tem API
dinâmica (retorna `iceServers` já com credenciais de curta duração, pedindo
pro servidor mais próximo) ou auth estática compartilhada
(`staticauth.openrelay.metered.ca` + secret público — menos recomendado).
A API key do Metered **não pode** ir embutida no app; o certo é o próprio
Worker expor uma rota tipo `/turn-credentials` que chama a API do Metered
usando a key guardada como secret (`wrangler secret put`), e devolve pro app
só as credenciais TURN temporárias.

**Custo**: plano free do Workers cobre Durable Objects com storage SQLite —
100 mil requisições/dia e 13.000 GB-s/dia de compute (mais que suficiente pro
uso da família). TURN limitado a 20 GB/mês grátis no Metered.

**Prós**: tudo gerenciado, sem servidor pra manter, TLS/`wss://` automático.
**Contras**: exige reescrever a camada de signaling do zero (WebSocket puro
em vez de Socket.IO); teto de 20 GB/mês no TURN pode faltar se usarem bastante
via 4G/5G; depende de duas contas externas (Cloudflare + Metered).

---

## Opção 2 — Cloudflare Tunnel (signaling em casa) + Oracle Cloud Free Tier (TURN)

**Signaling em casa, de graça, sem CGNAT**: usar `cloudflared` (Cloudflare
Tunnel) rodando no próprio notebook/servidor Linux de casa. Ele abre uma
conexão de **saída** até a borda da Cloudflare — não precisa de IP público
nem abrir porta no roteador — e a Cloudflare devolve uma URL pública
`https://`/`wss://` que redireciona pro `server/index.js` local. Isso resolve
100% a parte de signaling rodando em casa, sem custo, sem expirar.
Como o Tunnel encaminha HTTP/WebSocket normalmente, dá pra manter o
Socket.IO como está hoje — não precisa reescrever nada do lado do signaling
(ao contrário da Opção 1).

**TURN**: aqui é onde o CGNAT trava de verdade — TURN precisa aceitar conexão
UDP direta de qualquer celular na internet, num range de portas, e isso não
passa bem pelo Cloudflare Tunnel (que é pensado pra HTTP/WebSocket, não pra
UDP público arbitrário chegando de clientes quaisquer). A saída é hospedar o
`coturn` numa VPS com IP público de verdade — e a
[Oracle Cloud "Always Free"](https://www.oracle.com/cloud/free/) é a opção
que é genuinamente grátis pra sempre (não é trial), com specs generosas
(inclusive ARM: até 4 OCPUs / 24 GB RAM no tier Ampere). Roda o `coturn` lá,
sem depender da operadora e sem teto de uso tipo o Metered.

**Custo**: R$ 0 — Cloudflare Tunnel é grátis sem limite de uso relevante pra
esse caso; Oracle Free Tier é grátis pra sempre (sujeito aos termos deles,
não é cartão de crédito cobrado depois).

**Prós**: mantém o máximo possível rodando na nossa própria infra (o notebook
de casa continua sendo o "coração" do signaling); sem reescrever o protocolo
de signaling; TURN sem teto de banda artificial (só o que a VPS aguentar).
**Contras**: precisa manter e atualizar a VPS Oracle (coturn, patches, etc.);
mais peças móveis que a Opção 1 (dois serviços separados: Cloudflare Tunnel +
VPS); latência extra por não estar 100% em casa.

---

## Opção 3 — Servidor próprio 100% em casa (pedindo IP público pra operadora)

Se a operadora liberar um **IP público real** pro nosso link (muitas
operadoras no Brasil fazem isso de graça se você ligar e pedir; algumas
cobram uma taxa pequena), dá pra rodar **tudo** em casa, sem nenhuma
dependência externa: o `server/index.js` (signaling) e o `coturn` (TURN) no
mesmo notebook/servidor Linux, com port-forward configurado no roteador.

**Custo**: R$ 0 (ou uma taxa pequena, dependendo da operadora).

**Prós**: solução mais simples de entender e depurar — tudo num lugar só, sem
depender de Cloudflare, Oracle ou Metered; nenhum teto de uso artificial.
**Contras**: depende inteiramente da operadora liberar o IP público (nem
sempre é possível, e pode não ser permanente); precisa manter o notebook
ligado e conectado o tempo todo pra funcionar fora de casa; sem HTTPS/`wss://`
automático — teria que configurar certificado (ex.: Let's Encrypt) na mão;
se o IP público mudar (caso não seja fixo), precisa atualizar DNS/configuração
toda vez.

---

## Resumo comparativo

| | Onde roda o signaling | Onde roda o TURN | Precisa reescrever protocolo? | Depende da operadora? | Teto de uso |
|---|---|---|---|---|---|
| 1. Cloudflare Workers + Metered | Nuvem (Cloudflare) | Nuvem (Metered) | Sim (WebSocket puro) | Não | 20 GB/mês (TURN) |
| 2. Cloudflare Tunnel + Oracle Free | Casa (via túnel) | Nuvem (Oracle VPS) | Não | Não | Sem teto artificial |
| 3. Servidor próprio em casa | Casa | Casa | Não | Sim (precisa de IP público) | Sem teto |

Próximo passo (quando formos atacar isso): prototipar as 3 lado a lado com
uma chamada real em 4G, medir latência/confiabilidade, e decidir com base
no resultado prático — não só na teoria.
