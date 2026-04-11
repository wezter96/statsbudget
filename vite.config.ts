import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { renderOgSvg, type OgParams } from "./scripts/og-renderer";
import {
  buildRobotsTxt,
  buildSitemapXml,
  GITHUB_PAGES_HTML_ROUTES,
  normalizeBasePath,
} from "./src/lib/site-config";

const ogPlugin = (): Plugin => ({
  name: "statsbudget-og",
  configureServer(server) {
    server.middlewares.use("/api/og", (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const params: OgParams = Object.fromEntries(url.searchParams.entries());
      const svg = renderOgSvg(params);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.end(svg);
    });
  },
});

const githubPagesPlugin = ({
  siteUrl,
  basePath,
}: {
  siteUrl?: string;
  basePath?: string;
}): Plugin => ({
  name: "github-pages-artifacts",
  apply: "build",
  async closeBundle() {
    const distDir = path.resolve(__dirname, "dist");
    const indexPath = path.join(distDir, "index.html");
    const indexHtml = await readFile(indexPath, "utf8");

    await Promise.all([
      writeFile(path.join(distDir, "404.html"), indexHtml, "utf8"),
      writeFile(path.join(distDir, ".nojekyll"), "", "utf8"),
      ...GITHUB_PAGES_HTML_ROUTES.map(async (routePath) => {
        const routeDir = path.join(distDir, routePath.slice(1));
        await mkdir(routeDir, { recursive: true });
        await writeFile(path.join(routeDir, "index.html"), indexHtml, "utf8");
      }),
    ]);

    await writeFile(
      path.join(distDir, "robots.txt"),
      buildRobotsTxt({ siteUrl, basePath }),
      "utf8",
    );

    const sitemapXml = buildSitemapXml({ siteUrl, basePath });
    const sitemapPath = path.join(distDir, "sitemap.xml");
    if (sitemapXml) {
      await writeFile(sitemapPath, sitemapXml, "utf8");
    } else {
      await rm(sitemapPath, { force: true });
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    base: basePath,
    server: {
      host: "::",
      port: 47319,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), ogPlugin(), githubPagesPlugin({ siteUrl: env.VITE_SITE_URL, basePath })],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
