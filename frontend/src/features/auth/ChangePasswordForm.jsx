import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { changePassword } from '../../api/auth';
import FormAlert from '../../components/FormAlert';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from './applyApiError';
import useAuthSubmit from './hooks/useAuthSubmit';
import { changePasswordSchema } from './schemas';

const FIELDS = ['currentPassword', 'newPassword'];

export default function ChangePasswordForm({ onSuccess }) {
  const { submit, loading } = useAuthSubmit(changePassword);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setFormError(null);
    const result = await submit({ currentPassword, newPassword });
    if (result.ok) {
      onSuccess();
      return;
    }
    if (result.error.code === 'INVALID_CREDENTIALS') {
      setError('currentPassword', { type: 'server', message: 'Current password is incorrect' });
      return;
    }
    setFormError(applyApiError(result.error, setError, FIELDS));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormAlert>{formError}</FormAlert>
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with upper and lower case letters and a number."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <SubmitButton loading={loading} loadingLabel="Saving…" className="mt-2">
        Change password
      </SubmitButton>
    </form>
  );
}
