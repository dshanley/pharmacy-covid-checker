import { useState } from 'react';

export type WizardProps = {
  index: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
};

export type WizardTemplate = (
  body: JSX.Element,
  props: WizardProps,
) => JSX.Element;

export type WizardStep = (arg: WizardProps) => JSX.Element;

export const Wizard = ({
  template = (body) => body,
  steps,
}: {
  template?: WizardTemplate;
  steps: WizardStep[];
}) => {
  console.log('Mounting wizard component...');
  const [index, setIndex] = useState(0);
  const props = { index, setIndex };
  const currentStep = steps[index];
  const body = currentStep(props);
  return <div>{template(body, props)}</div>;
};
