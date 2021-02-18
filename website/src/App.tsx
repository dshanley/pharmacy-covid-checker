import React, { useContext } from 'react';
import './App.css';
import { NotifierForm, NotifierFormContext } from './Components/NotifierForm';
import { Wizard, WizardStep } from './Components/Wizard';
import formStyles from './Components/formStyles.module.scss';

const StepOne: WizardStep = ({ index, setIndex }) => {
  const { zipCode } = useContext(NotifierFormContext);

  const zipCodeFieldClassName = zipCode.valid
    ? formStyles.validField
    : zipCode.touched
    ? formStyles.invalidField
    : undefined;

  const zipCodeMessageClassName = zipCode.valid
    ? formStyles.validMessage
    : zipCode.touched
    ? formStyles.invalidMessage
    : undefined;

  return (
    <div>
      <h1>Step {index + 1}: Zip Code</h1>
      <form
        action="https://foo.com"
        method="POST"
        onSubmit={(e) => {
          e.preventDefault();
          zipCode.touch();
          if (zipCode.valid) {
            setIndex(index + 1);
          }
        }}
        className={formStyles.form}
      >
        <input
          className={zipCodeFieldClassName}
          name={zipCode.name}
          type="number"
          pattern="\d*"
          inputMode="numeric"
          value={zipCode.value}
          onChange={(e) => zipCode.set(e.target.value)}
          onBlur={zipCode.touch}
          placeholder="97214"
          onKeyDown={(e) => {
            if (e.code === 'Enter') {
              zipCode.touch();
            }
          }}
        />
        <span className={zipCodeMessageClassName}>
          {zipCode.valid
            ? '✓ Valid'
            : zipCode.touched
            ? '✘ ' +
              (zipCode.value.length === 0
                ? 'Cannot be blank'
                : 'Malformed zip code')
            : null}
        </span>
        <div>
          <input type="submit" value="Next" />
        </div>
      </form>
      {/* <button onClick={setIndex.bind(null, index + 1)}>Next</button> */}
    </div>
  );
};

const StepTwo: WizardStep = ({ index, setIndex }) => {
  return (
    <div>
      <h1>Step {index + 1}: Choose Pharmacy</h1>
      <p>bar</p>
      <button onClick={setIndex.bind(null, index - 1)}>Back</button>
    </div>
  );
};

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Vaccine Notifier</h1>
        <h3>
          Text alerts when COVID-19 vaccines become available at your local
          pharmacy.
        </h3>
      </header>
      <main role="main">
        <NotifierForm>
          <Wizard steps={[StepOne, StepTwo]} />
        </NotifierForm>
      </main>
    </div>
  );
};

export default App;
