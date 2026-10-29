export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  active: boolean;
  roles: string[];
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
  permissions: string[];
}

export interface CurrentUserResponse {
  user: AuthUser;
  permissions: string[];
}
