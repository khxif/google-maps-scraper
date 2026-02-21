import dotenv from 'dotenv';
dotenv.config();

export function getEnv(key: string, defaultValue?: string): string {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : (defaultValue ?? '');
}
