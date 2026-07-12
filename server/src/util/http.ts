import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async handler so thrown errors reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Domain error with an HTTP status code and Thai-friendly message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const unauthorized = (msg = 'กรุณาเข้าสู่ระบบ') => new ApiError(401, msg);
export const forbidden = (msg = 'ไม่มีสิทธิ์ดำเนินการ') => new ApiError(403, msg);
export const notFound = (msg = 'ไม่พบข้อมูล') => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);
