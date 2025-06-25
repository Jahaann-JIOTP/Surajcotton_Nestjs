// all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // This catches all exceptions, not just HttpException
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';

    // If it's an HTTP exception
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionMessage = exception.message;

      switch (status) {
        case HttpStatus.BAD_REQUEST:// 400
          message = 'Invalid request data'; 
          break;
        case HttpStatus.FORBIDDEN: //403
          message = 'You do not have permission to access this resource';
          break;
        case HttpStatus.NOT_FOUND: //404
          message = 'The requested resource was not found';
          break;
        case HttpStatus.UNAUTHORIZED: //401
          message = 'Authentication is required or invalid credentials';
          break;
        case HttpStatus.INTERNAL_SERVER_ERROR://500
          message = 'A server error occurred. Please try again later';
          break;
        default:
          message = exceptionMessage || message;
      }
    }
    // If it's a generic JavaScript error (non-HttpException)
    else if (exception instanceof Error) {
      message = exception.message || message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp,
    });
  }
}
