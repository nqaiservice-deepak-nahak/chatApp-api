import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(private readonly _appService: AppService) { }

  @Get('health')
  getHealth() {
    return this._appService.getHealth();
  }
}
