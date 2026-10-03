import { Prisma, PrismaClient } from "@prisma/client";

// The hosted database closes connections that sit idle, so the first query
// after a quiet spell can fail even though nothing is wrong. Those failures
// are retried instead of being shown to the user as an error.
const RETRY_DELAYS_MS = [150, 500, 1200];
const CONNECTION_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return CONNECTION_CODES.has(error.code);
  const message = error instanceof Error ? error.message : "";
  return /can't reach database|connection (was )?(closed|reset|terminated|refused)|server has closed|ECONNRESET|ETIMEDOUT|timed out/i.test(message);
}

function createClient() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ args, query }) {
        for (const delay of RETRY_DELAYS_MS) {
          try {
            return await query(args);
          } catch (error) {
            if (!isConnectionError(error)) throw error;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        return query(args);
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
