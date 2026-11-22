/**
 * Field.spec.tsx — the label↔control association.
 *
 * `Field` used to render its `<label>` with no `htmlFor` and its
 * control with no `id`, so a form field could only be reached by
 * placeholder. That is an accessibility gap (a screen reader has no
 * programmatic label to announce) *and* it blocks `getByLabel()` in
 * the end-to-end suite.
 *
 * These tests lock in the association so a future refactor of `Field`
 * can't silently drop it.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Input, Select, Textarea, AmountInput } from '@/components/Field';

describe('Field', () => {
  it('associates the label with a text input', async () => {
    const user = userEvent.setup();
    render(
      <Field label="Amount">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Amount');
    expect(input.tagName).toBe('INPUT');
    // The association is real, not just an attribute pairing — clicking
    // the label focuses the control.
    await user.click(screen.getByText('Amount'));
    expect(document.activeElement).toBe(input);
  });

  it('associates the label with a select', () => {
    render(
      <Field label="Type">
        <Select>
          <option value="cash">Cash</option>
        </Select>
      </Field>,
    );

    expect(screen.getByLabelText('Type').tagName).toBe('SELECT');
  });

  it('associates the label with a textarea', () => {
    render(
      <Field label="Note (optional)">
        <Textarea />
      </Field>,
    );

    expect(screen.getByLabelText('Note (optional)').tagName).toBe('TEXTAREA');
  });

  it('associates the label with an amount input', () => {
    render(
      <Field label="Amount">
        <AmountInput />
      </Field>,
    );

    expect(screen.getByLabelText('Amount').tagName).toBe('INPUT');
  });

  it('associates the label with a raw host element', () => {
    render(
      <Field label="From account">
        <select>
          <option value="a">Main Bank</option>
        </select>
      </Field>,
    );

    expect(screen.getByLabelText('From account').tagName).toBe('SELECT');
  });

  it('does not wire htmlFor to a non-labelable child', () => {
    render(
      <Field label="Category">
        <div role="button">Groceries</div>
      </Field>,
    );

    // No control to point at, so the label must not claim one — a
    // `for` that resolves to nothing misleads assistive tech.
    expect(screen.getByText('Category').getAttribute('for')).toBeNull();
  });

  it('keeps sibling content next to the control', () => {
    render(
      <Field label="From">
        <Select>
          <option value="a">Main Bank</option>
        </Select>
        <div>Balance: ৳5,000</div>
      </Field>,
    );

    // The "Balance:" hint is a sibling of the control, not part of it.
    // Wiring the label must not swallow it.
    expect(screen.getByText('Balance: ৳5,000')).toBeTruthy();
    expect(screen.getByLabelText('From').tagName).toBe('SELECT');
  });

  it('gives each field a distinct id', () => {
    render(
      <>
        <Field label="Name">
          <Input />
        </Field>
        <Field label="Name">
          <Input />
        </Field>
      </>,
    );

    const inputs = screen.getAllByLabelText('Name');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
  });

  it('respects an id the caller already set', () => {
    render(
      <Field label="Amount">
        <Input id="tx-amount" />
      </Field>,
    );

    // The caller's id wins, and the label must still point at it.
    expect(screen.getByLabelText('Amount').id).toBe('tx-amount');
    expect(screen.getByText('Amount').getAttribute('for')).toBe('tx-amount');
  });

  it('renders the hint and the error slot', () => {
    const { rerender } = render(
      <Field label="Target amount" hint="Total amount you want to reach.">
        <Input />
      </Field>,
    );
    expect(screen.getByText('Total amount you want to reach.')).toBeTruthy();

    rerender(
      <Field label="Target amount" hint="Total amount you want to reach." error="Amount must be greater than zero">
        <Input />
      </Field>,
    );
    // The hint gives way to the error — the error is the actionable text.
    expect(screen.queryByText('Total amount you want to reach.')).toBeNull();
    expect(screen.getByText('Amount must be greater than zero')).toBeTruthy();
  });
});
