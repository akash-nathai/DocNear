import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      endpoint: config.get<string>('s3.endpoint'),
      region: config.get<string>('s3.region') ?? 'ap-south-1',
      credentials: {
        accessKeyId: config.get<string>('s3.accessKey')!,
        secretAccessKey: config.get<string>('s3.secretKey')!,
      },
      // Required for MinIO and other S3-compatible services
      forcePathStyle: true,
    });
    this.bucket = config.get<string>('s3.bucket') ?? 'docnear';
  }

  /**
   * Upload a Buffer to S3 and return the object key.
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${buffer.length} bytes)`);
    return key;
  }

  /**
   * Generate a pre-signed GET URL valid for `expiresIn` seconds (default 1h).
   */
  async getSignedUrl(key: string, expiresIn = 3_600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Delete an object by key.
   */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.debug(`Deleted ${key}`);
  }

  /** Build a storage key under a well-known prefix. */
  static prescriptionKey(bookingId: string): string {
    return `prescriptions/${bookingId}/prescription.pdf`;
  }

  static rxUploadKey(orderId: string, filename: string): string {
    return `pharmacy/rx/${orderId}/${filename}`;
  }
}
