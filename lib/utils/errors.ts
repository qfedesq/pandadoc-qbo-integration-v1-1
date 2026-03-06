import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "APP_ERROR",
    public readonly expose = statusCode < 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

const DATABASE_UNAVAILABLE_PATTERNS = [
  /error in postgresql connection/i,
  /can't reach database server/i,
  /server has closed the connection/i,
  /connection (?:closed|terminated|reset)/i,
  /\bECONNRESET\b/i,
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
  /\bP1001\b/i,
];

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = getErrorMessage(error);
  return DATABASE_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function getPublicError(error: unknown) {
  if (error instanceof AppError) {
    return {
      message: error.expose ? error.message : "Internal server error.",
      statusCode: error.statusCode,
      code: error.code,
    };
  }

  if (error instanceof ZodError) {
    return {
      message: "Invalid request payload.",
      statusCode: 400,
      code: "INVALID_REQUEST",
    };
  }

  if (isDatabaseUnavailableError(error)) {
    return {
      message: "Service temporarily unavailable. The application database is not reachable.",
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
    };
  }

  return {
    message: "Internal server error.",
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
  };
}
