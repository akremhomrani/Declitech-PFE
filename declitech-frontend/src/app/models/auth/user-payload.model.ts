export interface UserPayload {
  sub: string;
  role: string;
  iat?: number;
  exp: number;
}
