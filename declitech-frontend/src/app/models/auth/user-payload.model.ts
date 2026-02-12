export interface UserPayload {
  sub: string; // username
  role: string; // user role
  iat?: number; // issued at (optional for cookie-based auth)
  exp: number; // expiration time
}
