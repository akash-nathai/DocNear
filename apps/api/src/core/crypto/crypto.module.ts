import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * CryptoModule — @Global so CryptoService is injectable anywhere.
 * Depends only on ConfigModule (already global).
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
