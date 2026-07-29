import { DecoratorConstant } from '@app/core/constants/decorator.constant';
import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as protected. Routes without this decorator are public by default.
 * Usage: @Authorize()
 */
export const Authorize = () => SetMetadata(DecoratorConstant.SECURED, true);
