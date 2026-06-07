import express from "express";
import cors from "cors";
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

dotenv.config();
const PORT = process.env.PORT || 4000;
const app = express();
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: any) => (req.user ? 1000 : 100),
  message: { error: "Too many requests! try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip),
});
app.use(limiter);

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

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send({ message: "ProBalance server is running" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1", financialYearRouter);
app.use("/api/v1", statementLineRouter);
app.use("/api/v1", annexureRouter);

app.use(errorMiddleware);

const server = app.listen(PORT, async () => {
  console.log(`Swagger Api Docs is available at http://localhost:${PORT}/api-docs`);
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.log(`Error while starting the server`, err);
});
