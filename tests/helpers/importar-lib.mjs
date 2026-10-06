import fs from "node:fs";

// The app uses extensionless ESM imports in a CommonJS package. Load these
// plain-JS library modules directly, without building or using a stale dist.
const urls = new Map();
function urlDoModulo(url) {
  if (urls.has(url.href)) return urls.get(url.href);
  const source = fs.readFileSync(url, "utf8").replace(
    /(\bfrom\s+)(["'])([^"']+)\2/g,
    (_, prefixo, aspas, nome) => {
      const destino = nome.startsWith(".")
        ? urlDoModulo(new URL(nome.endsWith(".js") ? nome : nome + ".js", url))
        : import.meta.resolve(nome);
      return prefixo + aspas + destino + aspas;
    },
  );
  const destino = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  urls.set(url.href, destino);
  return destino;
}
export const importarLib = (nome) => import(urlDoModulo(new URL("../../src/lib/" + nome + ".js", import.meta.url)));
