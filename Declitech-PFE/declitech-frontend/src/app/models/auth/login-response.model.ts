export interface LoginResponse {
  accessToken?: string;  // Not sent in response body (stored in httpOnly cookie)
  refreshToken?: string; // Not sent in response body (stored in httpOnly cookie)
  firstName: string;
  lastName: string;
  username: string;
  role: string;
}
