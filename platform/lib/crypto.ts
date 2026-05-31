import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Symmetric AES-256-GCM encryption keyed off AUTH_SECRET. Used for tokens at
 * rest (OneDrive refresh tokens). Output format:
 *
 *   base64( iv(12) || ciphertext || tag(16) )
 */
function key(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for token encryption')
  return createHash('sha256').update(secret).digest()
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, ct, tag]).toString('base64')
}

export function decryptToken(blob: string): string {
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < 12 + 16) throw new Error('encrypted blob too short')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const ct = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** Best-effort decrypt that returns null instead of throwing (for optional secrets). */
export function tryDecryptToken(blob: string | null | undefined): string | null {
  if (!blob) return null
  try {
    return decryptToken(blob)
  } catch {
    return null
  }
}

/** Safe display hint for a secret — never the full value. "sk-abc…wxyz". */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return '••••'
  return `${plain.slice(0, 3)}…${plain.slice(-4)}`
}
