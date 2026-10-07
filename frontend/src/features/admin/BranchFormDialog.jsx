import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createBranch, updateBranch } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from '../auth/applyApiError';
import useAction from '../../hooks/useAction';

const coordinate = (min, max, label) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max, `${label} must be between ${min} and ${max}`);

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the branch name').max(80, 'Keep the name under 80 characters'),
  latitude: coordinate(-90, 90, 'Latitude'),
  longitude: coordinate(-180, 180, 'Longitude'),
});

const FIELDS = ['name', 'latitude', 'longitude'];

const toValues = (branch) => ({
  name: branch?.name ?? '',
  latitude: branch?.latitude != null ? String(branch.latitude) : '',
  longitude: branch?.longitude != null ? String(branch.longitude) : '',
});

const submitRequest = ({ branch, body }) => (branch ? updateBranch(branch.id, body) : createBranch(body));

export default function BranchFormDialog({ open, branch, onClose, onSaved }) {
  const { run, loading } = useAction(submitRequest);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toValues(branch) });

  useEffect(() => {
    if (open) {
      reset(toValues(branch));
      setFormError(null);
    }
  }, [open, branch, reset]);

  const onSubmit = async (values) => {
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    const body = {};
    if (!branch || values.name !== branch.name) body.name = values.name;
    if (!branch || latitude !== branch.latitude || longitude !== branch.longitude) Object.assign(body, { latitude, longitude });
    if (branch && !Object.keys(body).length) {
      onClose();
      return;
    }
    setFormError(null);
    const result = await run({ branch, body });
    if (!result.ok) {
      if (result.error.code === 'BRANCH_NAME_TAKEN') {
        setError('name', { type: 'server', message: result.error.message });
        return;
      }
      setFormError(applyApiError(result.error, setError, FIELDS));
      return;
    }
    onSaved();
  };

  return (
    <Modal
      open={open}
      title={branch ? 'Edit branch' : 'Add branch'}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <SubmitButton form="branch-form" size="md" loading={loading} loadingLabel="Saving…">
            {branch ? 'Save' : 'Add branch'}
          </SubmitButton>
        </>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField label="Branch name" placeholder="e.g. Quezon City" error={errors.name?.message} {...register('name')} />
        <p className="text-ink-500 text-xs">
          Map position, used to recommend the nearest instructors. Right-click the branch in Google Maps and copy the
          two numbers it shows.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Latitude" inputMode="decimal" placeholder="14.5547" error={errors.latitude?.message} {...register('latitude')} />
          <TextField label="Longitude" inputMode="decimal" placeholder="121.0244" error={errors.longitude?.message} {...register('longitude')} />
        </div>
      </form>
    </Modal>
  );
}
