/**
 * InvestmentPlannerNewScreen — the way IN to a new plan.
 *
 * This used to be a kit-picker: three starter cards for DPS / FDR /
 * Savings, each pre-filling sensible defaults. But the plan screen
 * underneath already carries its own type picker — a three-way stamp
 * that reshapes the terms the moment you press it — so the picker was
 * a click that bought nothing, and it hid the one thing the user
 * actually has to decide.
 *
 * So this screen now does the only job it has: create an empty plan
 * and get out of the way, letting the plan screen be the document.
 *
 * The defaults are deliberately EMPTY, not the kits' numbers. A blank
 * plan reads as "a blank form"; a plan pre-filled with ৳ 5,000 and
 * 12 months reads as "a suggestion you have to undo", and most people
 * just accept the suggestion by accident.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../domain/store';

export function InvestmentPlannerNewScreen() {
  const navigate = useNavigate();
  const addInvestmentPlan = useStore(s => s.addInvestmentPlan);
  // React 18 StrictMode mounts effects twice in development, so the
  // plan must not be created twice. The ref guards it.
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    const id = addInvestmentPlan({
      type: 'fdr',
      principal: 0,
      monthlyContribution: 0,
      rate: 0,
      startDate: new Date().toISOString().slice(0, 10),
      termMonths: 12,
      institution: '',
      notes: '',
      name: '',
    });
    navigate(`/plan/invest/${id}`, { replace: true });
  }, [addInvestmentPlan, navigate]);

  // Nothing to show while the redirect happens — the plan screen is
  // the document, and a flash of a loading state would be a lie.
  return null;
}
