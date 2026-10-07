const { z } = require('zod');

// E.164: leading +, country digit 1-9, up to 14 more digits.
const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format, e.g. +639171234567');

const email = z.string().trim().toLowerCase().email();

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/\d/, 'Password needs a number');

const fullName = z.string().trim().min(2).max(120);

const registerSchema = {
  // `role` is intentionally absent: a public signup cannot choose its own role,
  // and .strict() makes an attempt to send one a 400 rather than a silent drop.
  body: z
    .object({
      email,
      password,
      fullName,
      phone: phone.optional(),
    })
    .strict(),
};

const loginSchema = {
  body: z.object({ email, password: z.string().min(1) }).strict(),
};

const changePasswordSchema = {
  body: z
    .object({ currentPassword: z.string().min(1), newPassword: password })
    .strict()
    .refine((b) => b.currentPassword !== b.newPassword, {
      path: ['newPassword'],
      message: 'New password must be different from the current one',
    }),
};

const googleSchema = {
  body: z.object({ idToken: z.string().min(10) }).strict(),
};

const facebookSchema = {
  body: z.object({ accessToken: z.string().min(10) }).strict(),
};

const requestOtpSchema = {
  body: z.object({ phone }).strict(),
};

const verifyOtpSchema = {
  body: z
    .object({
      phone,
      code: z.string().trim().regex(/^\d{4,8}$/, 'Code must be 4-8 digits'),
      fullName: fullName.optional(),
    })
    .strict(),
};

module.exports = {
  email,
  phone,
  password,
  fullName,
  changePasswordSchema,
  registerSchema,
  loginSchema,
  googleSchema,
  facebookSchema,
  requestOtpSchema,
  verifyOtpSchema,
};
