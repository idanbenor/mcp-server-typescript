#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DataForSEOClient, DataForSEOConfig } from './client/dataforseo.client.js';
import { SerpApiModule } from './modules/serp/serp-api.module.js';
import { KeywordsDataApiModule } from './modules/keywords-data/keywords-data-api.module.js';
import { OnPageApiModule } from './modules/onpage/onpage-api.module.js';
import { DataForSEOLabsApi } from './modules/dataforseo-labs/dataforseo-labs-api.module.js';
import { EnabledModulesSchema, isModuleEnabled } from './config/modules.config.js';
import { BaseModule, ToolDefinition } from './modules/base.module.js';
import { z } from 'zod';
import { BacklinksApiModule } from "./modulapp.post('/mcp', basicAuth, (req: Request, res: Response) => {
  (async () => {
    try {
      const username = req.username || process.env.DATAFORSEO_USERNAME;
      const password = req.password || process.env.DATAFORSEO_PASSWORD;

      if (!username || !password) {
        return res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Missing DataForSEO credentials" },
          id: null,
        });
      }

      const server = getServer(username, password);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      req.on('close', () => {
        transport.close();
        server.close();
      });

    } catch (err) {
      console.error("Error handling /mcp:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  })().catch(err => {
    console.error("Unexpected error in IIFE:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  });
});
es/backlinks/backlinks-api.module.js";
import { BusinessDataApiModule } from "./modules/business-data-api/business-data-api.module.js";
import { DomainAnalyticsApiModule } from "./modules/domain-analytics/domain-analytics-api.module.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request as ExpressRequest, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { name, version } from './utils/version.js';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Request extends ExpressRequest {
  username?: string;
  password?: string;
}

function getServer(username: string | undefined, password: string | undefined): McpServer {
  const server = new McpServer({
    name,
    version,
  });

  const dataForSEOConfig: DataForSEOConfig = {
    username: username || "",
    password: password || "",
  };

  const dataForSEOClient = new DataForSEOClient(dataForSEOConfig);
  const enabledModules = EnabledModulesSchema.parse(process.env.ENABLED_MODULES);
  const modules: BaseModule[] = [];

  if (isModuleEnabled('SERP', enabledModules)) {
    modules.push(new SerpApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('KEYWORDS_DATA', enabledModules)) {
    modules.push(new KeywordsDataApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('ONPAGE', enabledModules)) {
    modules.push(new OnPageApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('DATAFORSEO_LABS', enabledModules)) {
    modules.push(new DataForSEOLabsApi(dataForSEOClient));
  }
  if (isModuleEnabled('BACKLINKS', enabledModules)) {
    modules.push(new BacklinksApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('BUSINESS_DATA', enabledModules)) {
    modules.push(new BusinessDataApiModule(dataForSEOClient));
  }
  if (isModuleEnabled('DOMAIN_ANALYTICS', enabledModules)) {
    modules.push(new DomainAnalyticsApiModule(dataForSEOClient));
  }

  modules.forEach(module => {
    const tools = module.getTools();
    Object.entries(tools).forEach(([name, tool]) => {
      const typedTool = tool as ToolDefinition;
      const schema = z.object(typedTool.params);
      server.tool(name, typedTool.description, schema.shape, typedTool.handler);
    });
  });

  return server;
}

async function main() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.use(express.json());

  // ✅ Serve openapi.yaml + plugin manifest
  app.get("/openapi.yaml", (req, res) => {
    res.sendFile(path.join(__dirname, "../openapi.yaml"));
  });

  app.get("/.well-known/ai-plugin.json", (req, res) => {
    res.sendFile(path.join(__dirname, "../.well-known/ai-plugin.json"));
  });

  // ✅ Basic auth middleware
  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      next();
      return;
    }
    const base64Credentials = authHeader.split(' ')[1];
    const [username, password] = Buffer.from(base64Credentials, 'base64').toString('utf-8').split(':');
    req.username = username;
    req.password = password;
    next();
  };

  // ✅ POST /mcp handler
app.post('/mcp', basicAuth, (req: Request, res: Response) => {
  (async () => {
    try {
      const username = req.username || process.env.DATAFORSEO_USERNAME;
      const password = req.password || process.env.DATAFORSEO_PASSWORD;

      if (!username || !password) {
        return res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Missing DataForSEO credentials" },
          id: null,
        });
      }

      const server = getServer(username, password);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      req.on('close', () => {
        transport.close();
        server.close();
      });

    } catch (err) {
      console.error("Error handling /mcp:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  })().catch(err => {
    console.error("Unexpected error in IIFE:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  });
});


      }

      const server = getServer(username, password);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      req.on('close', () => {
        transport.close();
        server.close();
      });

    } catch (err) {
      console.error("Error handling /mcp:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.listen(port, () => {
    console.log(`🚀 MCP HTTP server is running on port ${port}`);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
