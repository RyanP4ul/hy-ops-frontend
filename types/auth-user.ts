export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  name: string;
  token_version: number;
  iat: number;
}
