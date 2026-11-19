import express, { type ErrorRequestHandler } from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import { clerkMiddleware, getAuth } from "@clerk/express";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";

import { env } from "./env";
import { formFileRoutes } from "./routes/form-files";

export const app = express();
app.set("trust proxy", 1);
const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "Sumikami API",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
  securitySchemes: { Authorization: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
});

app.use(
  cors({
    origin: env.AUTHORIZED_PARTIES,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  return res.json({ message: "Sumikami API is running" });
});

app.get("/health", (req, res) => {
  return res.json({ message: "Sumikami API is healthy", healthy: true });
});

logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", apiReference({ url: "/openapi.json" }));

app.use(
  clerkMiddleware({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    authorizedParties: env.AUTHORIZED_PARTIES,
  }),
);
app.use((req, res, next) => {
  if (req.headers.authorization && !getAuth(req).isAuthenticated) {
    res.status(401).json({ error: "Invalid or expired authentication token" });
    return;
  }
  next();
});

app.use(formFileRoutes());

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

const requestError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status =
    error?.type === "entity.too.large" ? 413 : error instanceof SyntaxError ? 400 : 500;
  res.status(status).json({
    error:
      status === 413
        ? "The request is too large."
        : status === 400
          ? "The request body is invalid."
          : "We couldn’t complete this request. Please try again.",
  });
};
app.use(requestError);

export default app;
