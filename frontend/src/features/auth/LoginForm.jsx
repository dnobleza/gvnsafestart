import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import FormAlert from '../../components/FormAlert';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from './applyApiError';
import useLogin from './hooks/useLogin';
import { loginSchema } from './schemas';

const FIELDS = ['email', 'password'];

export default function LoginForm() {
  const { submit, loading } = useLogin();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setFormError(null);
    const result = await submit(values);
    if (!result.ok) setFormError(applyApiError(result.error, setError, FIELDS));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <SubmitButton loading={loading} loadingLabel="Signing in…" className="mt-2">
        Log in
      </SubmitButton>
    </form>
  );
}
