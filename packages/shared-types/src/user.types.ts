import type { Role, UserStatus } from './enums';

/** Alias so consumers can use either `Role` or `UserRole`. */
export type UserRole = Role;

export interface UserDto {
  id: string;
  email?: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}
