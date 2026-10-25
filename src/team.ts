export const teamEmails = [
  "dmontoya@dichter-neira.com",
  "fvillalba@dichter-neira.com",
  "mcabezas@dichter-neira.com",
  "rrodriguez@dichter-neira.com",
] as const;

export const isTeamMember = (email: string) =>
  teamEmails.some((member) => member === email.trim().toLowerCase());
