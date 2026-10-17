import express, { type Express } from "express";
import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.disable("x-powered-by");
const configuredTrustProxyHops = process.env.TRUST_PROXY_HOPS;
const trustProxyHops = configuredTrustProxyHops === undefined
  ? process.env.VERCEL === "1" ? 1 : 0
  : Number(configuredTrustProxyHops);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
}
if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self)");
  if (req.get("x-forwarded-proto") === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    const origin = req.get("origin");
    try {
      if (!origin) {
        res.status(403).json({ error: "Request origin is not allowed." });
        return;
      }
      const originUrl = new URL(origin);
      const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0].trim();
      const protocol = forwardedProtocol || req.protocol;
      const expectedOrigin = `${protocol}://${req.get("host")}`;
      if (originUrl.origin !== expectedOrigin) {
        res.status(403).json({ error: "Request origin is not allowed." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
  }
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const status = typeof error === "object"
    && error !== null
    && "status" in error
    && typeof error.status === "number"
    && error.status >= 400
    && error.status < 500
    ? error.status
    : 500;
  if (status >= 500) {
    req.log.error({ err: error }, "Unhandled API error");
  } else {
    req.log.warn({ err: error, status }, "Request rejected");
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(status).json({
    error: status >= 500 ? "Internal server error." : "Request could not be processed.",
  });
};

app.use(errorHandler);

export default app;
