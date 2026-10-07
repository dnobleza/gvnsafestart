import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { addClientNote } from '../../api/instructor';
import Button from '../../components/Button';
import FormAlert from '../../components/FormAlert';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import SubmitButton from '../../components/SubmitButton';
import useAction from '../../hooks/useAction';
import { formatDateTime } from '../../utils/format';
import { useClient } from './hooks/useInstructorResources';

function NoteForm({ clientId, onAdded }) {
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const { run, loading, error } = useAction(addClientNote);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!note.trim()) return setFieldError('Write a note first');
    setFieldError(null);
    const result = await run(clientId, note.trim());
    if (result.ok) {
      setNote('');
      onAdded();
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mb-4 flex flex-col gap-3">
      <FormAlert>{error?.message}</FormAlert>
      <label htmlFor="client-note" className="text-ink-100 text-sm font-medium">
        Add a private note
      </label>
      <textarea
        id="client-note"
        rows={3}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-invalid={fieldError ? 'true' : undefined}
        className={
          'bg-surface-900 text-ink-100 placeholder:text-ink-500 block w-full rounded-xl border px-4 py-3 text-sm outline-none ' +
          'focus:border-accent-500 focus:ring-accent-500/30 focus:ring-2 ' +
          (fieldError ? 'border-danger-500' : 'border-surface-600')
        }
        placeholder="Only you can see this"
      />
      {fieldError ? <p className="text-danger-300 text-sm">{fieldError}</p> : null}
      <div>
        <SubmitButton size="md" loading={loading} loadingLabel="Saving…">
          Save note
        </SubmitButton>
      </div>
    </form>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useClient(id);

  return (
    <>
      <PageHeader
        title={data?.client.fullName || 'Client'}
        description={data ? [data.client.phone, data.client.email].filter(Boolean).join(' · ') : null}
        actions={
          <Button variant="ghost" size="sm" to="/instructor/clients">
            All clients
          </Button>
        }
      />
      {loading && !data ? (
        <div className="bg-surface-900 h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-danger-300 text-sm">{error.code === 'CLIENT_NOT_FOUND' ? 'Client not found.' : error.message}</p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Session history</h2>
            {data.sessions.length ? (
              <ul className="divide-surface-800 divide-y">
                {data.sessions.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/instructor/bookings/${b.id}`}
                      className="hover:text-accent-300 flex items-center justify-between gap-3 py-3"
                    >
                      <span>
                        <span className="text-ink-100 block text-sm">{formatDateTime(b.scheduledAt)}</span>
                        <span className="text-ink-500 block text-xs">{b.lessonType}</span>
                      </span>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500 text-sm">No sessions.</p>
            )}
          </section>
          <section className="border-surface-700 bg-surface-900 rounded-xl border p-5">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">My notes</h2>
            <NoteForm clientId={id} onAdded={refetch} />
            {data.notes.length ? (
              <ul className="flex flex-col gap-3">
                {data.notes.map((n) => (
                  <li key={n.id} className="border-surface-800 rounded-xl border p-3">
                    <p className="text-ink-100 text-sm whitespace-pre-wrap">{n.note}</p>
                    <p className="text-ink-500 mt-1 text-xs">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500 text-sm">No notes yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
