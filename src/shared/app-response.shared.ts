import { HttpStatus } from '@nestjs/common';

interface AppResponse {
  code: HttpStatus;
  message: string;
  data?: any;
  description?: any;
}

const createResponse = (code: HttpStatus, message: string, data?: any): AppResponse => {
  return { code, message, data };
};

export { AppResponse, createResponse };
