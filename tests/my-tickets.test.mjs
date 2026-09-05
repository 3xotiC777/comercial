import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/sharepoint.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const columns = [
  ["Title", "Título"], ["correo", "Correo"], ["estado", "Estado"],
  ["responsable", "Responsable"], ["solucion", "Solución"],
  ["fechaFinal", "Fecha finalización"], ["archivos", "Archivos solución"],
].map(([name, displayName]) => ({ name, displayName }));
const item = (id, overrides = {}) => ({
  id, createdDateTime: `2026-09-0${id}T12:00:00Z`,
  lastModifiedDateTime: "2026-09-05T14:00:00Z",
  fields: { Title: `DN-${id}`, correo: "persona@empresa.com", estado: "Pendiente", ...overrides },
});

function service({ profile = { mail: "persona@empresa.com" }, pages = [{ value: [] }], fail = false } = {}) {
  const requests = [];
  let pageIndex = 0;
  class FakeMsal {
    async initialize() {}
    getActiveAccount() { return { username: profile.mail }; }
    getAllAccounts() { return []; }
    setActiveAccount() {}
    async acquireTokenSilent() { return { accessToken: "test-token" }; }
  }
  const fetch = async (url, init) => {
    requests.push({ url, init });
    const path = new URL(url).pathname;
    let body;
    if (path.endsWith("/me")) body = profile;
    else if (path.includes(":/sites/reportingdn")) body = { id: "site" };
    else if (path.endsWith("/lists")) body = { value: [{ id: "list", displayName: "Comercial planeacion" }] };
    else if (path.endsWith("/columns")) body = { value: columns };
    else if (path.endsWith("/drives")) body = { value: [{ id: "drive", name: "Comercial planeacion proyecto" }] };
    else if (path.endsWith("/items")) {
      if (fail) return new Response(JSON.stringify({ error: { message: "Acceso denegado" } }), { status: 403 });
      body = pages[pageIndex++];
    } else throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const exports = {};
  new Function("require", "exports", "window", "fetch", compiled)(
    () => ({ PublicClientApplication: FakeMsal }), exports,
    { location: { hostname: "localhost", origin: "http://localhost" } }, fetch,
  );
  return { api: exports, requests };
}

test("obtiene el correo de Microsoft, consulta todas sus páginas y conserva los datos del ticket", async () => {
  const { api, requests } = service({ profile: { mail: " Persona@Empresa.com " }, pages: [
    { value: [item("1"), item("2", { correo: "otra@empresa.com" })],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/site/lists/list/items?$skiptoken=next" },
    { value: [item("3", { correo: "PERSONA@EMPRESA.COM", estado: "Finalizado", responsable: "miguel",
      solucion: "<p>Se corrigió el informe.</p>", fechaFinal: "2026-09-04T12:00:00Z", archivos: "informe.xlsx; resumen.pdf" })] },
  ] });
  const { email, tickets } = await api.loadMyTickets();
  assert.equal(email, "persona@empresa.com");
  assert.deepEqual(tickets.map((ticket) => ticket.id), ["DN-3", "DN-1"]);
  assert.equal(tickets[0].status, "Finalizado");
  assert.equal(tickets[0].assignee, "Miguel Cabezas");
  assert.equal(tickets[0].created_at, "2026-09-03T12:00:00Z");
  assert.equal(tickets[0].updated_at, "2026-09-05T14:00:00Z");
  assert.equal(tickets[0].completed_at, "2026-09-04T12:00:00Z");
  assert.equal(tickets[0].resolution, "<p>Se corrigió el informe.</p>");
  assert.deepEqual(tickets[0].resolution_files, ["informe.xlsx", "resumen.pdf"]);
  const listRequests = requests.filter(({ url }) => new URL(url).pathname.endsWith("/items"));
  assert.equal(listRequests.length, 2);
  assert.equal(new URL(listRequests[0].url).searchParams.get("$filter"), "fields/correo eq 'persona@empresa.com'");
  assert.equal(listRequests[0].init.headers.get("Authorization"), "Bearer test-token");
});

test("no consulta SharePoint si Microsoft no devuelve una identidad de correo", async () => {
  const { api, requests } = service({ profile: {} });
  await assert.rejects(api.loadMyTickets(), /no devolvió un correo/);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.includes("/me?"));
});

test("acepta el nombre de usuario corporativo y devuelve un historial vacío", async () => {
  const { api } = service({ profile: { mail: null, userPrincipalName: "persona@empresa.com" } });
  assert.deepEqual(await api.loadMyTickets(), { email: "persona@empresa.com", tickets: [] });
});

test("escapa apóstrofes del correo en el filtro OData", async () => {
  const { api, requests } = service({ profile: { mail: "o'neal@empresa.com" } });
  await api.loadMyTickets();
  assert.equal(new URL(requests.at(-1).url).searchParams.get("$filter"), "fields/correo eq 'o''neal@empresa.com'");
});

test("propaga errores de permisos sin convertirlos en un historial vacío", async () => {
  const { api } = service({ fail: true });
  await assert.rejects(api.loadMyTickets(), /403.*Acceso denegado/);
});

test("no envía credenciales a una página de otro origen", async () => {
  const { api, requests } = service({ pages: [{ value: [], "@odata.nextLink": "https://example.com/items" }] });
  await assert.rejects(api.loadMyTickets(), /no válida/);
  assert.ok(requests.every(({ url }) => url.startsWith("https://graph.microsoft.com/")));
});
