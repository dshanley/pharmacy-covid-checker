import { useState } from 'react';

export type WizardProps = {
  forward: () => void;
  back: () => void;
  index: number;
};

export type WizardTemplate = (
  body: JSX.Element,
  props: WizardProps,
) => JSX.Element;

export type WizardStep = (arg: WizardProps) => JSX.Element;

export const Wizard = ({ steps }: { steps: WizardStep[] }) => {
  console.log('Rendering wizard component...');
  const [index, setIndex] = useState(0);
  const props = {
    forward: () => {
      window.scrollTo(0,0);
      setIndex(index + 1);
    },
    back: () => {
      window.scrollTo(0,0);
      setIndex(index - 1);
    },
    index,
  };
  const CurrentStep = steps[index];
  return <CurrentStep {...props} />;
};
