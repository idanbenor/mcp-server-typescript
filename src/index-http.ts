#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request as ExpressRequest, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { DataForSEOClient, DataForSEOConfig } from "./client/dataforseo.client.js";
import { SerpApiModule } from "./modules/serp/serp-api.module.js";
import { KeywordsDataApiModule } from "./modules/keywords-data/keywords-data-api.module.js";
import { OnPageApiModule } from "./modules/onpage/onpage-api.module.js";
import { DataForSEOLabsApi } from "./modules/dataforseo-labs/dataforseo-labs-api.module.js";
import { BacklinksApiModule } from "./modules/backlinks/backlinks-api.module.js";
import { BusinessDataApiModule } from "./modules/business-data-api/business-data-api.module.js";
import { DomainAnalyticsApiModule } from "./modules/domain-analytics/domain-analytics-api.module.js";
import { EnabledModulesSchema, isModuleEnabled } from "./config/modules.config.js";
import { BaseModule, ToolDefinition } from "./modules/base.module.js";
import { name, version } from "./utils/version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

interface Request extends ExpressRequest {
  username?: string;
  password?: string;
}

/* ---------- מכין MCP Server עם כל המודולים ---------- */
function getServer(username: string | undefined,
                   password: string | undefined): McpServer {

  const server = new McpServer({ name, version });

  const dataForSEOConfig: DataForSEOConfig = {
    username: username || "",
    password: password || ""
  };
  const dataForSEOClient = new DataForSEOClient(dataForSEOConfig);

  const enabled = EnabledModulesSchema.parse(process.env.ENABLED_MODULES);
  const modules: BaseModule[] = [];

  if (isModuleEnabled("SERP", enabled))            modules.push(new SerpApiModule(dataForSEOClient));
  if (isModuleEnabled("KEYWORDS_DATA", enabled))   modules.push(new KeywordsDataApiModule(dataForSEOClient));
  if (isModuleEnabled("ONPAGE", enabled))          modules.push(new OnPageApiModule(dataForSEOClient));
  if (isModuleEnabled("DATAFORSEO_LABS", enabled)) modules.push(new DataForSEOLabsApi(dataForSEOClient));
  if (isModuleEnabled("BACKLINKS", enabled))       modules.push(new BacklinksApiModule(dataForSEOClient));
  if (isModuleEnabled("BUSINESS_DATA", enabled))   modules.push(new BusinessDataApiModule(dataForSEOClient));
  if (isModuleEnabled("DOMAIN_ANALYTICS", enabled))modules.push(new DomainAnalyticsApiModule(dataForSEOClient));

  modules.forEach(m => {
    Object.entries(m.getTools()).forEach(([toolName, tool]) => {
      const def = tool as ToolDefinition;
      const schema = z.object(def.params);
      server.tool(toolName, def.description, schema.shape, def.handler);
    });
  });

  return server;
}

/* ---------- אפליקציה ---------- */
async function main() {
  const app  = express();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json());

  /* ★ Middleware שמוסיף text/event-stream לכותרת Accept אם חסר ★
     - ה-GPT Builder שולח רק application/json ‏:contentReference[oaicite:2]{index=2}
     - Transport דורש את שניהם ‏:contentReference[oaicite:3]{index=3}                                    */
  app.use((req, _res, next) => {
    if (req.method === "POST" && req.path === "/mcp") {
      const current = req.headers.accept?.toString() ?? "application/json";
      const needsJson = !current.includes("application/json");
      const needsSse  = !current.includes("text/event-stream");
      if (needsJson && needsSse) {
        req.headers.accept = "application/json, text/event-stream";
      } else if (needsJson) {
        req.headers.accept = `${current}, application/json`;
      } else if (needsSse) {
        req.headers.accept = `${current}, text/event-stream`;
      }
    }
    next();
  });

  /* ---------- Static files עבור ChatGPT ---------- */
  app.get("/openapi.yaml", (_req, res) =>
    res.sendFile(path.join(__dirname, "../openapi.yaml"))
  );
  app.get("/.well-known/ai-plugin.json", (_req, res) =>
    res.sendFile(path.join(__dirname, "../.well-known/ai-plugin.json"))
  );

  /* ---------- Basic-Auth (אופציונלי) ---------- */
  const basicAuth = (req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith("Basic ")) return next();
    const [u, p] = Buffer.from(hdr.split(" ")[1], "base64")
                         .toString("utf8")
                         .split(":");
    req.username = u;
    req.password = p;
    next();
  };

  /* ---------- Route MCP ---------- */
  app.post("/mcp", basicAuth, (req: Request, res: Response) => {
    (async () => {
      try {
        const username = req.username ?? process.env.DATAFORSEO_USERNAME;
        const password = req.password ?? process.env.DATAFORSEO_PASSWORD;

        if (!username || !password) {
          return res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Missing DataForSEO credentials" },
            id: null
          });
        }

        const server    = getServer(username, password);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID()
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);

        req.on("close", () => { transport.close(); server.close(); });

      } catch (err) {
        console.error("Error handling /mcp:", err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null
          });
        }
      }
    })().catch(err => {
      console.error("Unexpected error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    });
  });

  app.listen(port, () =>
    console.log(`🚀 MCP HTTP server is running on port ${port}`)
  );
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
