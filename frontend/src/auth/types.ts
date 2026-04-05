export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}
