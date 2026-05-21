import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule — @Global so PrismaService is available everywhere
 * without importing this module in every domain module.
 *
 * Import DatabaseModule in AppModule once; inject PrismaService anywhere.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
