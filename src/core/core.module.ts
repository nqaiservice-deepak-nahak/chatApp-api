import { exportProviders, getProviders, importProviders } from '@app/core/providers';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [...getProviders()],
  imports: [...importProviders()],
  exports: [...exportProviders()]
})
export class CoreModule {}
