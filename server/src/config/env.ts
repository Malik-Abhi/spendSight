export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getJwtSecret() {
  return getRequiredEnv('JWT_SECRET');
}
