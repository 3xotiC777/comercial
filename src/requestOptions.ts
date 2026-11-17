export const catalog: Record<string, string[]> = {
  BOLIVIA: ["P&G"],
  CHILE: ["COCA COLA (KO TRD)", "CANASTA", "PLANIFICACION", "AUDITORES"],
  COLOMBIA: [
    "NESTLE (DSD)",
    "NESTLE (ISD)",
    "NESTLE (UTT)",
    "SAMSUNG",
    "COCA COLA (KO MD)-PLANOGRAMA",
    "COCA COLA (KO MD)",
  ],
  "COSTA RICA": [
    "CARGILL",
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "FIFCO MOD",
    "FIFCO TRD",
    "NESTLE",
    "P&G",
  ],
  ECUADOR: ["CBC - EC", "COCA COLA (KO TRD)", "P&G", "CBC EC", "P&G_SC"],
  "EL SALVADOR": [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "NESTLE",
    "P&G",
    "CERVECERIA",
    "ABI CRECE",
  ],
  GUATEMALA: [
    "CBC - GM",
    "COCA COLA (KO MD)- ABVO",
    "COCA COLA (KO MD)- EMBO",
    "COCA COLA (KO TRD)- ABVO",
    "COCA COLA (KO TRD)- EMBO",
    "NESTLE",
    "P&G",
    "CBC GT",
  ],
  HONDURAS: [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "NESTLE",
    "P&G",
    "CERVECERIA",
    "ABI CRECE",
    "CBC - HN",
  ],
  NICARAGUA: ["COCA COLA (KO MD)", "COCA COLA (KO TRD)", "NESTLE", "P&G"],
  PANAMA: [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "HEINEKEN",
    "NESTLE",
    "P&G",
    "REPRICO",
  ],
  PARAGUAY: ["P&G"],
  PERU: [
    "ABI",
    "ABI DAS",
    "GLORIA",
    "LINDLEY",
    "STOREVIEW ABI PERU",
    "STOREVIEW MD IRT ABI PERU",
    "CBC MYSTERY",
    "GLORIA SV TRADICIONAL",
    "GLORIA SC TRADICIONAL",
    "AJE",
    "Lindley - Auditor",
  ],
  "REPUBLICA DOMINICANA": [
    "COCA COLA (KO MD)",
    "COCA COLA (KO TRD)",
    "CORRIPIO",
    "P&G",
    "INDUVECA",
    "PEPSI",
    "INDUSTRIA SAN MIGUEL",
  ],
  URUGUAY: ["P&G"],
  VENEZUELA: ["COCA COLA (KO TRD)"],
};
export const customerStudies = ["Walmart", "Bimbo", "Nestlé", "Otros"];

const requestTypes = ["Muestra", "Cotizaciones", "Analisis", "Ruteador", "Otros"];
const routingStudies = [...new Set(Object.values(catalog).flat())]
  .sort((a, b) => a.localeCompare(b, "es"));

export function requestTypesFor(business: string): string[] {
  return requestTypes.filter((type) => type !== "Ruteador" || business === "Trade");
}

export function studiesFor(business: string, country: string, type: string): string[] {
  if (type === "Ruteador") return business === "Trade" ? routingStudies : [];
  return business === "Customer" ? customerStudies : catalog[country] || [];
}

export function validateRoutingRequest(ticket: {
  business: string; request_type: string; country: string; study: string;
}) {
  if (ticket.request_type.trim().toLowerCase() !== "ruteador") return;
  if (ticket.business !== "Trade")
    throw new Error("Ruteador solo está disponible para el negocio Trade.");
  if (!Object.hasOwn(catalog, ticket.country))
    throw new Error("Selecciona un país válido para la solicitud de Ruteador.");
  if (!routingStudies.includes(ticket.study))
    throw new Error("Selecciona un estudio del catálogo de Trade para Ruteador.");
}
