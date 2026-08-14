import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as debts from '../domain/debts';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import type { DebtDirection } from '../domain/types';

export function DebtAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [total, setTotal] = useState('');
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Debt name is required', why: 'Debts without a name cannot be tracked.', fix: 'Enter a name (e.g. "Loan from Rahim").' });
      return;
    }
    if (!(Number(total) > 0)) {
      showBanner({ what: 'Total must be greater than zero', why: 'Zero or negative totals make the debt meaningless.', fix: 'Enter a positive number.' });
      return;
    }
    try {
      update(s => debts.add(s, {
        name, direction, total: Number(total),
        person: person.trim() || undefined,
        dueDate: dueDate || undefined,
      }));
      navigate('/debts');
    } catch (err) {
      showBanner({ what: 'Could not add debt', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <header>
        <h1 className="heading h1-screen">Add debt</h1>
        <div className="text-muted text-[13px] mt-1.5">Track what you owe or what others owe you.</div>
      </header>
      <section className="card flex flex-col gap-5">
        <Field label="Direction">
          <Select value={direction} onChange={e => setDirection(e.target.value as DebtDirection)}>
            <option value="i_owe">I owe (you borrowed)</option>
            <option value="owed_to_me">Owed to me (you lent)</option>
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Loan from Rahim, advance to Karim…" autoFocus />
        </Field>
        <Field label="Total amount">
          <Input type="number" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="10000" />
        </Field>
        <Field label="Person (optional)">
          <Input value={person} onChange={e => setPerson(e.target.value)} placeholder="Rahim, Karim…" />
        </Field>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button variant="primary" type="submit">Save debt</Button>
          <Button variant="ghost" onClick={() => navigate('/debts')}>Cancel</Button>
        </div>
      </section>
    </form>
  );
}