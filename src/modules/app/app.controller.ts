import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(private readonly _appService: AppService) { }

  @Get('health')
  @ApiOperation({summary:'Health check — confirms the API is up.'})
  getHealth() {
    return this._appService.getHealth();
  }
}
