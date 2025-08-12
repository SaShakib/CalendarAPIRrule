import { Request, Response, NextFunction } from "express";

export function mockAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id") || "user123";
  const isAdminHeader = req.header("x-user-admin");
  const isAdmin = isAdminHeader
    ? isAdminHeader.toLowerCase() === "true"
    : false;

  req.userId = userId;
  req.isAdmin = isAdmin;

  next();
}

export function canModifyEvent(req: Request, eventCreatedBy: string) {
  return !!(req.isAdmin || req.userId === eventCreatedBy);
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}
