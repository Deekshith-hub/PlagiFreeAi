export interface User {
  id?: string;
  email?: string;
  daily_limit: number;
  rewrites_today: number;
  remaining?: number;
  credits?: number;
  reset_date: string;
  email_verified?: boolean;
  is_admin?: boolean;
}
