import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodeCrypto from 'crypto';

/**
 * CryptoService — AES-256-CBC field-level encryption + SHA-256 hash shadows.
 *
 * ENCRYPTION_KEY env var must be 64 hex characters (= 32 bytes).
 *
 * Wire format (stored as BYTEA):
 *   [16 bytes IV] || [ciphertext]
 *
 * Hash shadows (stored as VARCHAR for DB indexing):
 *   SHA-256(normalised_plaintext) → 64 hex chars
 *
 * Design notes:
 *  - A fresh random IV per encryption makes the ciphertext non-deterministic.
 *  - Hash shadows are deterministic (same input → same hash) so they can be
 *    used for exact-match lookups without decrypting.
 *  - Email hashes are lower-cased first; phone hashes are stored as-is (E.164).
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private readonly ALGORITHM = 'aes-256-cbc' as const;
  private readonly IV_LENGTH = 16;
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const hexKey = this.config.get<string>('encryption.key');
    if (!hexKey || hexKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
    this.logger.log('Encryption key loaded');
  }

  // ── Encryption ─────────────────────────────────────────────────────────────

  /**
   * Encrypt a plaintext string → Buffer (IV + ciphertext).
   * Safe to store as BYTEA in PostgreSQL.
   */
  encrypt(plaintext: string): Buffer {
    const iv = nodeCrypto.randomBytes(this.IV_LENGTH);
    const cipher = nodeCrypto.createCipheriv(this.ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt a Buffer (IV + ciphertext) → plaintext string.
   */
  decrypt(ciphertextWithIv: Buffer): string {
    const iv = ciphertextWithIv.subarray(0, this.IV_LENGTH);
    const data = ciphertextWithIv.subarray(this.IV_LENGTH);
    const decipher = nodeCrypto.createDecipheriv(this.ALGORITHM, this.key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  // ── Hash shadows ───────────────────────────────────────────────────────────

  /**
   * SHA-256(lower(email)) — deterministic, used for uniqueness and lookup.
   */
  hashEmail(email: string): string {
    return nodeCrypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * SHA-256(phone) — phone must be normalised to E.164 before calling.
   */
  hashPhone(phone: string): string {
    return nodeCrypto.createHash('sha256').update(phone.trim()).digest('hex');
  }

  /**
   * SHA-256(token) — used for password-reset token storage (never store plaintext tokens).
   */
  hashToken(token: string): string {
    return nodeCrypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a cryptographically secure random token (URL-safe hex).
   */
  generateToken(bytes = 32): string {
    return nodeCrypto.randomBytes(bytes).toString('hex');
  }
}
