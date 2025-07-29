import { Request } from 'express';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  avatar?: string | null;
  dateJoined: Date;
  lastProfileUpdate: Date;
  isDeleted: boolean;
}

export interface Entry {
  id: string;
  title: string;
  synopsis: string;
  content: string;
  isDeleted: boolean;
  dateCreated: Date;
  lastUpdated: Date;
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    avatar?: string | null;
    dateJoined: Date;
  };
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  emailOrUsername: string;
  password: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateEntryData {
  title: string;
  synopsis: string;
  content: string;
}

export interface UpdateEntryData {
  title?: string;
  synopsis?: string;
  content?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  [key: string]: any;
}