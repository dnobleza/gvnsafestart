import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import FormAlert from '../../components/FormAlert';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from './applyApiError';
import useRegister from './hooks/useRegister';
import { registerSchema, toRegisterBody } from './schemas';

const FIELDS = ['fullName', 'email', 'phone', 'password'];

export default function RegisterForm() {
  const { submit, loading } = useRegister();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    const result = await submit(toRegisterBody(values));
    if (!result.ok) setFormError(applyApiError(result.error, setError, FIELDS));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <TextField
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Mobile number (optional)"
        type="tel"
        autoComplete="tel"
        placeholder="+639171234567"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with upper and lower case letters and a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <SubmitButton loading={loading} loadingLabel="Creating account…" className="mt-2">
        Create account
      </SubmitButton>
    </form>
  );
}
