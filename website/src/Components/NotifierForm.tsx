import { createContext, useState } from 'react';

export type AbstractFormField<T> = {
  name: string;
  value: T;
  set: (arg: T) => void;
  valid: boolean;
  touched: boolean;
  touch: () => void;
};

export type NotifierFormContext = {
  zipCode: AbstractFormField<string>;
};

// @ts-ignore
// GOTCHA: https://stackoverflow.com/questions/61333188/react-typescript-avoid-context-default-value
export const NotifierFormContext = createContext<NotifierFormContext>();

// https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s14.html
const zipCodeRegExp = /^[0-9]{5}$/;

export const NotifierForm = ({ children }: { children: JSX.Element }) => {
  const [zipCode, setZipCode] = useState('');
  const [zipCodeTouched, setZipCodeTouched] = useState(false);
  const ctx = {
    zipCode: {
      name: 'zipCode',
      value: zipCode,
      set: setZipCode,
      valid: zipCodeRegExp.test(zipCode),
      touched: zipCodeTouched,
      touch: setZipCodeTouched.bind(null, true),
    },
  };

  return (
    <NotifierFormContext.Provider value={ctx}>
      {children}
    </NotifierFormContext.Provider>
  );
};
