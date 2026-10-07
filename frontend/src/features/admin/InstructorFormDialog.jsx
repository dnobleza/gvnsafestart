import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createInstructor, updateInstructor } from '../../api/admin';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import Modal from '../../components/Modal';
import SelectField from '../../components/SelectField';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import applyApiError from '../auth/applyApiError';
import useAction from '../../hooks/useAction';
import { useBranchOptions } from './hooks/useAdminResources';

const ADDRESS_FIELDS = ['street', 'barangay', 'city', 'province'];

const required = (message) => z.string().trim().min(1, message).max(200, 'Keep this under 200 characters');

const baseShape = {
  fullName: z.string().trim().min(2, 'Enter their full name').max(120, 'Name must be 120 characters or fewer'),
  street: required('Enter the street'),
  barangay: required('Enter the barangay'),
  city: required('Enter the city or municipality'),
  province: required('Enter the province'),
  branchId: z.string().min(1, 'Choose a location'),
};

const createSchema = z.object({
  ...baseShape,
  email: z.string().trim().toLowerCase().min(1, 'Enter their email').email('Enter a valid email'),
});

const editSchema = z.object(baseShape);

const EMPTY = { fullName: '', email: '', street: '', barangay: '', city: '', province: '', branchId: '' };

const toValues = (instructor) =>
  instructor
    ? {
        fullName: instructor.fullName,
        email: instructor.email,
        ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, instructor.address?.[f] ?? ''])),
        branchId: instructor.branch?.id ?? '',
      }
    : EMPTY;

const toAddress = (values) => Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, values[f]]));

// The API reports nested address errors as "address.street"; the form keeps
// address parts flat, so strip the prefix before placing them.
const flattenFieldErrors = (apiError) => ({
  ...apiError,
  fieldErrors: Object.fromEntries(
    Object.entries(apiError.fieldErrors).map(([key, message]) => [key.replace(/^address\./, ''), message]),
  ),
});

const FORM_FIELDS = ['fullName', 'email', ...ADDRESS_FIELDS, 'branchId'];

const submitRequest = ({ instructor, body }) =>
  instructor ? updateInstructor(instructor.id, body) : createInstructor(body);

export default function InstructorFormDialog({ open, instructor, onClose, onSaved }) {
  const editing = Boolean(instructor);
  const { run, loading } = useAction(submitRequest);
  const branches = useBranchOptions();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(editing ? editSchema : createSchema), defaultValues: toValues(instructor) });

  useEffect(() => {
    if (open) {
      reset(toValues(instructor));
      setFormError(null);
    }
  }, [open, instructor, reset]);

  const branchOptions = useMemo(() => {
    const active = branches.data || [];
    const current = instructor?.branch;
    const list = current && !active.some((b) => b.id === current.id) ? [{ ...current, inactive: true }, ...active] : active;
    return [
      { value: '', label: branches.loading ? 'Loading branches…' : 'Select a branch' },
      ...list.map((b) => ({ value: b.id, label: b.inactive ? `${b.name} (inactive)` : b.name })),
    ];
  }, [branches.data, branches.loading, instructor]);

  const close = () => {
    reset(EMPTY);
    setFormError(null);
    onClose();
  };

  const onSubmit = async (values) => {
    setFormError(null);
    let body;
    if (editing) {
      const before = toValues(instructor);
      body = {};
      if (values.fullName !== before.fullName) body.fullName = values.fullName;
      if (ADDRESS_FIELDS.some((f) => values[f] !== before[f])) body.address = toAddress(values);
      if (values.branchId !== before.branchId) body.branchId = values.branchId;
      if (!Object.keys(body).length) {
        close();
        return;
      }
    } else {
      body = { fullName: values.fullName, email: values.email, address: toAddress(values), branchId: values.branchId };
    }

    const result = await run({ instructor, body });
    if (!result.ok) {
      setFormError(applyApiError(flattenFieldErrors(result.error), setError, FORM_FIELDS));
      return;
    }
    reset(EMPTY);
    onSaved(result.data);
  };

  return (
    <Modal
      open={open}
      title={editing ? 'Edit instructor' : 'Add instructor'}
      onClose={loading ? () => {} : close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <SubmitButton form="instructor-form" size="md" loading={loading} loadingLabel="Saving…">
            {editing ? 'Save changes' : 'Create account'}
          </SubmitButton>
        </>
      }
    >
      <form id="instructor-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormAlert>{formError || (branches.error ? 'Could not load locations. Close and try again.' : null)}</FormAlert>
        <TextField label="Full name" autoComplete="off" error={errors.fullName?.message} {...register('fullName')} />
        {editing ? (
          <div>
            <p className="text-ink-100 text-sm font-medium">Email</p>
            <p className="text-ink-400 mt-2 px-5 text-sm">{instructor.email}</p>
          </div>
        ) : (
          <TextField
            label="Email"
            type="email"
            autoComplete="off"
            hint="Used to sign in. Cannot be changed later."
            error={errors.email?.message}
            {...register('email')}
          />
        )}
        <SelectField label="Location" options={branchOptions} error={errors.branchId?.message} {...register('branchId')} />
        <fieldset className="border-surface-700 rounded-xl border p-4">
          <legend className="text-ink-100 px-1 text-sm font-medium">Address</legend>
          <p className="text-ink-500 mb-3 text-xs">Only admins can see this.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Street" className="sm:col-span-2" error={errors.street?.message} {...register('street')} />
            <TextField label="Barangay" error={errors.barangay?.message} {...register('barangay')} />
            <TextField label="City / municipality" error={errors.city?.message} {...register('city')} />
            <TextField label="Province" className="sm:col-span-2" error={errors.province?.message} {...register('province')} />
          </div>
        </fieldset>
        {editing ? null : (
          <p className="text-ink-500 text-xs">
            A temporary password is generated for them and shown once after you create the account.
          </p>
        )}
      </form>
    </Modal>
  );
}
