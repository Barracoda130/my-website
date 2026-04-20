export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  allowed_sections: string[];
}

export interface LoginPayload {
  username: string;
  password: string;
}
