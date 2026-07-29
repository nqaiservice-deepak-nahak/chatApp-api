import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import { DecoratorConstant } from '@app/core/constants/decorator.constant';
import AppLogger from '@app/core/loggers/app-logger';
import { messages } from '@app/shared/messages.shared';
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

/**
 * Global guard. Routes are public by default; only routes annotated with
 * @Authorize() are checked for a valid Bearer JWT. On success, the decoded
 * claims are attached to `request.claims` for controllers/services to use.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly _logger: AppLogger,
    private readonly _appConfigSvc: AppConfigService,
    private readonly _jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /*
     * getAllAndOverride checks BOTH the route handler and the controller
     * class for the SECURED metadata (handler takes precedence). This is
     * required because @Authorize() is applied at the class level on
     * GroupsController/MessagesController - checking only getHandler()
     * (as earlier) would silently skip auth for every route in those
     * controllers and leave `request.claims` unset.
     */
    const secured = this.reflector.getAllAndOverride<boolean>(DecoratorConstant.SECURED, [context.getHandler(), context.getClass()]);

    /*If the route is not annotated with @Authorize(), allow it through*/
    if (!secured) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let bearerToken = request.headers['authorization'];

    if (!bearerToken) {
      throw new HttpException(messages.W12, HttpStatus.UNAUTHORIZED);
    }

    bearerToken = bearerToken.replace('Bearer', '').trim();
    if (!bearerToken) {
      throw new HttpException(messages.W12, HttpStatus.UNAUTHORIZED);
    }

    try {
      const secret = this._appConfigSvc.get(AppConfig.JWT)?.accessTokenSecret;
      const payload = await this._jwtService.verifyAsync(bearerToken, { secret });
      request.claims = { userId: payload.userId, name: payload.name, email: payload.email };
      return true;
    } catch (error) {
      this._logger.error(__filename, AuthGuard.name, HttpStatus.UNAUTHORIZED, error.message);
      throw new HttpException(messages.W10, HttpStatus.UNAUTHORIZED);
    }
  }
}
