import { useEffect, useState } from 'react';

import Button from './Button';
import SelectField from './SelectField';
import TextField from './TextField';
import useDebouncedValue from '../hooks/useDebouncedValue';

function ClientSearch({ value, onChange }) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // Only the debounced text should trigger a URL update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <TextField
      label="Client"
      type="search"
      placeholder="Name or email"
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

export default function FilterBar({ filters, setFilter, onReset, statusOptions, withClient = true, withDates = true }) {
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="mb-4 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      {withDates ? (
        <>
          <TextField label="From" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          <TextField label="To" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </>
      ) : null}
      {withClient ? <ClientSearch value={filters.client} onChange={(v) => setFilter('client', v)} /> : null}
      {statusOptions ? (
        <SelectField
          label="Status"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          options={statusOptions}
        />
      ) : null}
      <Button variant="ghost" onClick={onReset} disabled={!active}>
        Clear filters
      </Button>
    </div>
  );
}
