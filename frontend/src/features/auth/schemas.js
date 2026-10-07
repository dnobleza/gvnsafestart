import { z } from 'zod';

const email = z.string().trim().toLowerCase().min(1, 'Enter your email').email('Enter a valid email');

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/\d/, 'Password needs a number');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

// Mirrors backend/src/validators/auth.validator.js so most mistakes are caught
// before the request; the API stays the authority and its field errors are
// still mapped back onto the form.
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your full name')
      .max(120, 'Name must be 120 characters or fewer'),
    email,
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+[1-9]\d{7,14}$/.test(v), {
        message: 'Use international format, e.g. +639171234567',
      }),
    password: strongPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const toRegisterBody = ({ fullName, email, phone, password }) => ({
  fullName,
  email,
  password,
  ...(phone ? { phone } : {}),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
