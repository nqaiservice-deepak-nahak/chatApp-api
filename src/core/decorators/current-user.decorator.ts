import { AtPayload } from '@app/shared/model.shared';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user's claims (set by AuthGuard) from the request.
 * Usage: async myRoute(@CurrentUser() claims: AtPayload)
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.claims;
});
