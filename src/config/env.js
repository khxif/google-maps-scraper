import dotenv from 'dotenv';
dotenv.config();

export function getEnv(key, defaultValue) {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : defaultValue;
}
