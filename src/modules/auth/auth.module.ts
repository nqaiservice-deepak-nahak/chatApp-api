import { Module } from '@nestjs/common';
import { AuthAbstractSvc } from './auth.abstract';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthAbstractSvc,
      useClass: AuthService
    }
  ],
  exports: [AuthAbstractSvc]
})
export class AuthModule {}
