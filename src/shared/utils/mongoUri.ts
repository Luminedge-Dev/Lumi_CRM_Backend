// Classifies a MongoDB connection string as local (loopback) or not. Used by the API's startup
// database guard (config/database.ts) and by the maintenance-script guard (scripts/scriptGuard.ts).
// Nothing here connects to a database, and the connection string is never logged.

// Exactly the loopback hosts. 0.0.0.0 is deliberately absent (it is not a loopback address).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Host part of one URI host entry: drops the port and the brackets around an IPv6 literal ("[::1]:27017" -> "::1"). */
const normalizeHost = (entry: string): string => {
  const h = entry.trim().toLowerCase();
  const bracketed = /^\[([^\]]*)\](?::\d+)?$/.exec(h);
  return bracketed ? bracketed[1] : h.replace(/:\d+$/, '');
};

/** True only when every host in the URI is a loopback address. An unparseable URI counts as NOT local. */
export const isLocalMongoUri = (uri: string | undefined): boolean => {
  if (!uri) return false;
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri.trim());
  if (!match) return false;
  if (/^mongodb\+srv:/i.test(uri.trim())) return false; // SRV hosts are always remote clusters
  const hosts = match[1].split(',').map(normalizeHost);
  return hosts.length > 0 && hosts.every((h) => LOCAL_HOSTS.has(h));
};
