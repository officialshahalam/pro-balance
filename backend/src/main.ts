import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Request, Response } from "express";
import { errorMiddleware } from "./packages/error-handler/error-middleware";
import authRouter from "./modules/auth/auth.controller";
import clientRouter from "./modules/client/client.controller";
import financialYearRouter from "./modules/financial-year/financial-year.controller";
import statementLineRouter from "./modules/statement-line/statement-line.controller";
import annexureRouter from "./modules/annexure/annexure.controller";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import prisma from "./configs/prisma";

dotenv.config();

// Fail fast on missing/weak critical configuration.
if (!process.env.DATABASE_URL) {
  throw new Error("Missing required env var: DATABASE_URL");
}
if (!process.env.ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET.length < 32) {
  throw new Error("ACCESS_TOKEN_SECRET must be set and at least 32 characters");
}
for (const v of ["FRONTEND_URL", "SMTP_USER", "SMTP_PASS", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
  if (!process.env[v]) console.warn(`[startup] Warning: env var ${v} is not set`);
}

const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(cookieParser());
app.set("trust proxy", 1);

// Decode the JWT once (cookie or Bearer) for rate-limit tiering — does NOT enforce auth.
app.use((req: any, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.access_token || (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, { algorithms: ["HS256"] }) as { id: number };
      req.rlUserId = decoded.id;
    } catch {
      /* invalid token → treated as unauthenticated for limiting */
    }
  }
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: any) => (req.rlUserId ? 2000 : 100),
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => (req.rlUserId ? `user:${req.rlUserId}` : ipKeyGenerator(req.ip)),
});
app.use(limiter);

// Stricter limit on unauthenticated auth endpoints (login / signup / OTP) to blunt brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip),
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send({ message: "ProBalance server is running" });
});

// API docs are not exposed in production.
if (!isProd) {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "ProBalance API",
        version: "1.0.0",
        description: "Financial reporting API for Chartered Accountants",
      },
      servers: [{ url: `http://localhost:${PORT}` }],
    },
    apis: ["./src/modules/**/*.ts"],
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1", financialYearRouter);
app.use("/api/v1", statementLineRouter);
app.use("/api/v1", annexureRouter);

app.use(errorMiddleware);

const server = app.listen(PORT, () => {
  if (!isProd) console.log(`Swagger API docs at http://localhost:${PORT}/api-docs`);
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.error("Error while starting the server", err);
});

// Graceful shutdown — finish in-flight requests and close the DB before exit.
const shutdown = (signal: string) => {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
