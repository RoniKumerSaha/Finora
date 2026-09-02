/**
 * PinCells.spec.tsx — internal behaviour of the OTP input component.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PinCells } from '../PinCells';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('PinCells — auto-advance', () => {
  it('advances focus to box 2 after typing into box 1', async () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <PinCells value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    const user = userEvent.setup();
    const b1 = screen.getByLabelText('Digit 1') as HTMLInputElement;
    await user.click(b1);
    await user.keyboard('1');
    const b2 = screen.getByLabelText('Digit 2') as HTMLInputElement;
    expect(document.activeElement).toBe(b2);
  });

  it('clicking box 3 focuses it', async () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <PinCells value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    const user = userEvent.setup();
    const b3 = screen.getByLabelText('Digit 3') as HTMLInputElement;
    await user.click(b3);
    expect(document.activeElement).toBe(b3);
  });

  it('typing 6 digits fills all six boxes', async () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <PinCells value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    const user = userEvent.setup();
    const b1 = screen.getByLabelText('Digit 1') as HTMLInputElement;
    await user.click(b1);
    await user.keyboard('123456');
    for (let i = 1; i <= 6; i++) {
      const box = screen.getByLabelText(`Digit ${i}`) as HTMLInputElement;
      expect(box.value).toBe(String(i));
    }
  });
});
