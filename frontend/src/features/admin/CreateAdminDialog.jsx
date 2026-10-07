import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createAdmin } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from '../auth/applyApiError';
import useAction from '../../hooks/useAction';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter their full name').max(120, 'Name must be 120 characters or fewer'),
  email: z.string().trim().toLowerCase().min(1, 'Enter their email').email('Enter a valid email'),
});

const FIELDS = ['fullName', 'email'];
const DEFAULTS = { fullName: '', email: '' };

export default function CreateAdminDialog({ open, onClose, onCreated }) {
  const { run, loading } = useAction(createAdmin);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const close = () => {
    reset(DEFAULTS);
    setFormError(null);
    onClose();
  };

  const onSubmit = async (values) => {
    setFormError(null);
    const result = await run(values);
    if (!result.ok) {
      setFormError(applyApiError(result.error, setError, FIELDS));
      return;
    }
    reset(DEFAULTS);
    onCreated(result.data);
  };

  return (
    <Modal
      open={open}
      title="Add admin"
      onClose={loading ? () => {} : close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <SubmitButton form="create-admin" size="md" loading={loading} loadingLabel="Creating…">
            Create account
          </SubmitButton>
        </>
      }
    >
      <form id="create-admin" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField label="Full name" autoComplete="off" error={errors.fullName?.message} {...register('fullName')} />
        <TextField label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
        <p className="text-ink-500 text-xs">
          Admins have full access to the dashboard. A temporary password is generated and shown once after you
          create the account.
        </p>
      </form>
    </Modal>
  );
}
