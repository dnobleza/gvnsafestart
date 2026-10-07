import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getSettings, runAutoCompleteNow, updateSettings } from '../../api/admin';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import SubmitButton from '../../components/SubmitButton';
import TextField from '../../components/TextField';
import useAction from '../../hooks/useAction';
import useListParams from '../../hooks/useListParams';
import useResource from '../../hooks/useResource';
import { formatDateTime } from '../../utils/format';
import { showToast } from '../../utils/toast';
import applyApiError from '../auth/applyApiError';
import { useAutoCompleteRuns, useAutoCompleteStatus } from './hooks/useAdminResources';

const schema = z.object({
  autoCompleteGraceHours: z.coerce
    .number({ message: 'Enter a number' })
    .int('Use a whole number')
    .min(0, 'At least 0')
    .max(72, 'At most 72'),
});

const NO_FILTERS = [];

const TRIGGER_LABEL = { SCHEDULE: 'Schedule', EXTERNAL: 'External', ADMIN: 'Run now' };

const summaryOf = (r) => `${r.completed} completed · ${r.cancelled} cancelled · ${r.cashUnpaid} cash unpaid`;

const COLUMNS = [
  { key: 'startedAt', header: 'Started', className: 'whitespace-nowrap', render: (r) => formatDateTime(r.startedAt) },
  { key: 'trigger', header: 'Trigger', render: (r) => TRIGGER_LABEL[r.trigger] || r.trigger },
  {
    key: 'status',
    header: 'Result',
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: 'counts',
    header: 'Bookings',
    render: (r) => (r.error ? <span className="text-danger-300 text-xs">{r.error}</span> : summaryOf(r)),
  },
];

function GraceForm() {
  const { data, loading, error, refetch } = useResource(getSettings);
  const save = useAction(updateSettings);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data) reset({ autoCompleteGraceHours: data.autoCompleteGraceHours });
  }, [data, reset]);

  const onSubmit = async (values) => {
    setFormError(null);
    if (!isDirty) return;
    const result = await save.run(values);
    if (!result.ok) {
      setFormError(applyApiError(result.error, setError, ['autoCompleteGraceHours']));
      return;
    }
    reset({ autoCompleteGraceHours: result.data.autoCompleteGraceHours });
    showToast('Grace period saved.', { tone: 'success' });
  };

  if (loading && !data) return <div className="bg-surface-900 h-40 animate-pulse rounded-xl" aria-busy="true" />;
  if (error) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="text-danger-300 text-sm">{error.message}</p>
        <Button variant="secondary" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="border-surface-700 bg-surface-900 flex flex-col gap-4 rounded-xl border p-5"
    >
      <h2 className="text-sm font-semibold tracking-tight">Grace period</h2>
      <FormAlert>{formError}</FormAlert>
      <TextField
        label="Hours after the session ends"
        hint="Confirmed sessions are completed this long after they end, giving instructors time to mark no-shows first."
        inputMode="numeric"
        error={errors.autoCompleteGraceHours?.message}
        {...register('autoCompleteGraceHours')}
      />
      <div>
        <SubmitButton size="md" loading={save.loading} loadingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

function StatusPanel({ status, loading, error, onRetry, onRun }) {
  const last = status?.lastRun;
  return (
    <section className="border-surface-700 bg-surface-900 flex flex-col gap-4 rounded-xl border p-5" aria-label="Status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Status</h2>
        <Button size="sm" onClick={onRun} disabled={!status}>
          Run now
        </Button>
      </div>
      {loading && !status ? (
        <div className="bg-surface-800 h-24 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.message}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : status ? (
        <>
          {last?.status === 'FAILED' ? (
            <p role="alert" className="border-danger-500/40 text-danger-300 rounded-xl border p-3 text-sm">
              The last run failed: {last.error || 'unknown error'}
            </p>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-ink-500 text-xs">Last run</dt>
              <dd className="text-ink-100 text-sm">{last ? formatDateTime(last.startedAt) : 'Never'}</dd>
            </div>
            <div>
              <dt className="text-ink-500 text-xs">Next scheduled run</dt>
              <dd className="text-ink-100 text-sm">
                {status.enabled ? formatDateTime(status.nextRunAt) : 'Scheduler off (ENABLE_CRON)'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500 text-xs">Last result</dt>
              <dd className="text-ink-100 text-sm">
                {!last ? '—' : last.status === 'SUCCESS' ? summaryOf(last) : last.status.toLowerCase()}
              </dd>
            </div>
          </dl>
          <p className="text-ink-500 text-xs">Runs every 15 minutes ({status.timezone}) when the scheduler is on.</p>
        </>
      ) : null}
    </section>
  );
}

export default function AutoCompletePage() {
  const { page, setPage } = useListParams(NO_FILTERS);
  const status = useAutoCompleteStatus();
  const runs = useAutoCompleteRuns(page);
  const run = useAction(runAutoCompleteNow);
  const [confirming, setConfirming] = useState(false);

  const runNow = async () => {
    const result = await run.run();
    if (!result.ok) return;
    setConfirming(false);
    const r = result.data;
    if (r.status === 'SUCCESS') showToast(`Auto-complete finished: ${summaryOf(r)}.`, { tone: 'success' });
    else if (r.status === 'SKIPPED') showToast('Another run is in progress, so this one was skipped.');
    else showToast(`Auto-complete failed: ${r.error || 'unknown error'}`, { tone: 'error' });
    status.refetch();
    runs.refetch();
  };

  return (
    <>
      <PageHeader
        title="Auto-complete"
        description="Completes confirmed sessions after they end and cancels pending ones that were never confirmed."
        actions={
          <Button variant="ghost" size="sm" to="/admin/settings">
            All settings
          </Button>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <GraceForm />
        <StatusPanel
          status={status.data}
          loading={status.loading}
          error={status.error}
          onRetry={status.refetch}
          onRun={() => setConfirming(true)}
        />
      </div>
      <h2 className="mb-3 text-sm font-semibold tracking-tight">Run history</h2>
      <DataTable
        caption="Auto-complete runs"
        columns={COLUMNS}
        rows={runs.data}
        loading={runs.loading}
        error={runs.error}
        onRetry={runs.refetch}
        emptyMessage="No runs yet."
      />
      <Pagination meta={runs.meta} onPageChange={setPage} disabled={runs.loading} />
      <ConfirmDialog
        open={confirming}
        title="Run auto-complete now?"
        confirmLabel="Run now"
        busyLabel="Running…"
        loading={run.loading}
        error={run.error}
        onClose={() => {
          run.reset();
          setConfirming(false);
        }}
        onConfirm={runNow}
      >
        Every confirmed session past its end plus the grace period is completed, and pending sessions past their start
        are cancelled. Clients and instructors are notified.
      </ConfirmDialog>
    </>
  );
}
