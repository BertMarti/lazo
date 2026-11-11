// Protección anti-SSRF del extractor de enlaces: qué URL y qué IP se pueden visitar.
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], // «esta red»
  ['10.0.0.0', 8], // privada
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local y metadatos de la nube (169.254.169.254)
  ['172.16.0.0', 12], // privada
  ['192.0.0.0', 24], // asignaciones IETF
  ['192.0.2.0', 24], // documentación
  ['192.168.0.0', 16], // privada
  ['198.18.0.0', 15], // pruebas de rendimiento
  ['198.51.100.0', 24], // documentación
  ['203.0.113.0', 24], // documentación
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservada y broadcast
]) blocked.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 96], // sin especificar e IPv4-compatible (::7f00:1)
  ['64:ff9b:1::', 48], // NAT64 local
  ['2001::', 32], // Teredo
  ['2002::', 16], // 6to4
  ['fec0::', 10], // site-local (obsoleto)
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (podría apuntar a IPv4 internas)
  ['100::', 64], // descarte
  ['2001:db8::', 32], // documentación
  ['fc00::', 7], // ULA (privada)
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
]) blocked.addSubnet(net, bits, 'ipv6');

/** ¿Es una IP a la que nunca debemos conectarnos? Las IPv4 mapeadas en IPv6 (::ffff:a.b.c.d) se miran como IPv4. */
export function isBlockedIp(ip) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isBlockedIp(mapped[1]);
  const v = isIP(ip);
  if (v === 4) return blocked.check(ip, 'ipv4');
  if (v === 6) return blocked.check(ip, 'ipv6') || /^::ffff:/i.test(ip);
  return true; // lo que no es una IP válida, fuera
}

/** Valida la URL antes de resolverla: http/https, puertos 80/443, sin credenciales, longitud razonable. */
export function checkUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new UnfurlError('bad_url');
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new UnfurlError('bad_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnfurlError('bad_url');
  if (u.username || u.password) throw new UnfurlError('bad_url');
  if (u.port && u.port !== '80' && u.port !== '443') throw new UnfurlError('bad_port');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlockedIp(host)) throw new UnfurlError('blocked');
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home\.arpa)$/i.test(host)) throw new UnfurlError('blocked');
  return u;
}

export class UnfurlError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
