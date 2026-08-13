import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';
import * as goals from '../domain/goals';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';

export function GoalAddScreen() {
  const navigate = useNavigate();
  const update = useStore(s => s.update);
  const showBanner = useStore(s => s.showBanner);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0');
  const [targetDate, setTargetDate] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showBanner({ what: 'Goal name is required', why: 'Goals without a name cannot be tracked.', fix: 'Enter a name (e.g. "Emergency fund").' });
      return;
    }
    if (!(Number(target) > 0)) {
      showBanner({ what: 'Target must be greater than zero', why: 'Zero or negative targets make the goal meaningless.', fix: 'Enter a positive number.' });
      return;
    }
    if (!targetDate) {
      showBanner({ what: 'Target date is required', why: 'Goals without dates cannot compute the per-month requirement (R5).', fix: 'Pick a date in the future.' });
      return;
    }
    try {
      update(s => goals.add(s, { name, target: Number(target), saved: Number(saved) || 0, targetDate }));
      navigate('/goals');
    } catch (err) {
      showBanner({ what: 'Could not add goal', why: (err as Error).message, fix: 'Try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 max-w-md">
      <h1 className="text-2xl font-semibold">Add goal</h1>
      <Field label="Name">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Emergency fund, laptop…" autoFocus />
      </Field>
      <Field label="Target amount">
        <Input type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} placeholder="50000" />
      </Field>
      <Field label="Already saved (optional)" hint="What you've already saved toward this goal.">
        <Input type="number" inputMode="decimal" value={saved} onChange={e => setSaved(e.target.value)} />
      </Field>
      <Field label="Target date">
        <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">Save goal</Button>
        <Button variant="ghost" onClick={() => navigate('/goals')}>Cancel</Button>
      </div>
    </form>
  );
}