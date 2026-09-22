/** Store plain addresses, separated by semicolons as Outlook expects. */
export function normalizeCc(input: string, requesterEmail = ""): string {
  const addresses = input.split(/[;,\r\n]+/).map((value) => value.trim()).filter(Boolean);
  const invalid = addresses.find((email) =>
    email.length > 254 || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email),
  );
  if (invalid) throw new Error(`Revisa el correo en CC: “${invalid}”. Escribe solo direcciones de correo, separadas por ; o ,.`);
  const unique = [...new Set(addresses.map((email) => email.toLowerCase()))]
    .filter((email) => email !== requesterEmail.trim().toLowerCase());
  if (unique.length > 50) throw new Error("Puedes agregar hasta 50 correos en CC.");
  return unique.join("; ");
}
