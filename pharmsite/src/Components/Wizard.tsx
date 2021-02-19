import { useState } from 'react';

export type WizardProps = {
  index: number;
  setIndex: (arg: number) => void;
};

export type WizardTemplate = (
  body: JSX.Element,
  props: WizardProps,
) => JSX.Element;

export type WizardStep = (arg: WizardProps) => JSX.Element;

export const Wizard = ({ steps }: { steps: WizardStep[] }) => {
  console.log('Rendering wizard component...');
  const [index, setIndex] = useState(0);
  const props = { index, setIndex };
  const CurrentStep = steps[index];
  return <CurrentStep {...props} />;
};
