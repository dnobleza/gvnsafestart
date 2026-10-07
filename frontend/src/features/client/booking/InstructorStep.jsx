import { useState } from 'react';

import Button from '../../../components/Button';
import Pagination from '../../../components/Pagination';
import SelectField from '../../../components/SelectField';
import TextField from '../../../components/TextField';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { formatDay, formatTime } from '../../../utils/format';
import { useInstructorBrowse, useLocations, useRecommended } from '../hooks/useClientResources';

const ratingText = (rating) => (rating.isNew ? 'New' : `★ ${rating.display} (${rating.count})`);

function InstructorCard({ instructor, selected, onSelect, extra }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(instructor)}
        aria-pressed={selected}
        className={
          'flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ' +
          (selected ? 'border-accent-500 bg-accent-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600')
        }
      >
        <span className="min-w-0">
          <span className="text-ink-100 block text-sm font-medium">{instructor.fullName}</span>
          <span className="text-ink-500 block text-xs">{instructor.branch?.name || 'No branch'}</span>
          {extra}
        </span>
        <span className={`shrink-0 text-xs tabular-nums ${instructor.rating.isNew ? 'text-ink-400' : 'text-accent-300'}`}>
          {ratingText(instructor.rating)}
        </span>
      </button>
    </li>
  );
}

function Feedback({ resource, empty }) {
  if (resource.loading && !resource.data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface-800 h-16 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (resource.error) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="text-danger-300 text-sm">{resource.error.message}</p>
        <Button variant="secondary" size="sm" onClick={resource.refetch}>
          Retry
        </Button>
      </div>
    );
  }
  if (!resource.data?.length) return <p className="text-ink-500 text-sm">{empty}</p>;
  return null;
}

function Recommended({ location, date, duration, onDateChange, minDate, selectedId, onSelect }) {
  const recommended = useRecommended(location, date, duration);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        className="max-w-xs"
        label="Preferred date"
        type="date"
        min={minDate}
        value={date}
        onChange={(e) => e.target.value && onDateChange(e.target.value)}
      />
      <Feedback resource={recommended} empty="No instructors are taking bookings near you yet." />
      {recommended.data?.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {recommended.data.map((i) => (
            <InstructorCard
              key={i.id}
              instructor={i}
              selected={selectedId === i.id}
              onSelect={onSelect}
              extra={
                <span className="text-ink-400 mt-1 block text-xs">
                  {i.distanceKm === null ? 'Distance unknown' : `${i.distanceKm} km away`} ·{' '}
                  {i.nextAvailableSlot
                    ? `Next: ${formatDay(i.nextAvailableSlot.start)}, ${formatTime(i.nextAvailableSlot.start)}`
                    : 'No openings in the next 2 weeks'}
                </span>
              }
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Browse({ selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebouncedValue(search);
  const branches = useLocations();
  const results = useInstructorBrowse({ search: term || undefined, locationId: locationId || undefined }, page);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Search by name"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          label="Branch"
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            setPage(1);
          }}
          options={[{ value: '', label: 'All branches' }, ...(branches.data || []).map((b) => ({ value: b.id, label: b.name }))]}
        />
      </div>
      <Feedback resource={results} empty="No instructors match." />
      {results.data?.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {results.data.map((i) => (
            <InstructorCard key={i.id} instructor={i} selected={selectedId === i.id} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
      <Pagination meta={results.meta} onPageChange={setPage} disabled={results.loading} />
    </div>
  );
}

export default function InstructorStep({ location, date, duration, onDateChange, minDate, instructor, onSelect, onBack, onNext }) {
  const [tab, setTab] = useState('recommended');

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Choose your instructor</h2>
        <p className="text-ink-400 text-sm">Nearest first, near {location.label}.</p>
      </div>
      {instructor ? (
        <p className="text-ink-400 text-sm" role="status">
          Selected: <span className="text-ink-100 font-medium">{instructor.fullName}</span>
          {instructor.branch ? ` · ${instructor.branch.name}` : ''}
        </p>
      ) : null}
      <div className="border-surface-700 flex w-fit rounded-full border p-0.5" role="tablist" aria-label="Instructor list">
        {[
          ['recommended', 'Recommended'],
          ['browse', 'Choose instructor'],
        ].map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            size="sm"
            variant={tab === key ? 'primary' : 'ghost'}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === 'recommended' ? (
        <Recommended
          location={location}
          date={date}
          duration={duration}
          onDateChange={onDateChange}
          minDate={minDate}
          selectedId={instructor?.id}
          onSelect={onSelect}
        />
      ) : (
        <Browse selectedId={instructor?.id} onSelect={onSelect} />
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!instructor}>
          Continue
        </Button>
      </div>
    </section>
  );
}
