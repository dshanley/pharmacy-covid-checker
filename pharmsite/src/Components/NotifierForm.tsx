import { createContext, useState, useContext } from 'react';
import { Wizard, WizardStep } from './Wizard';
import styles from './NotifierForm.module.scss';
import axios from 'axios';

export type CompanyName = 'RiteAid' | 'Walmart';

export type Pharmacy = {
  storeId: string;
  address: string;
  companyName: CompanyName;
};

// NotifierFormValuesTypes mapped to NotifierFormFieldTypes
export type NotifierFormContextType = {
  zipCode: {
    value: string;
    set: (arg: string) => void;
    touched: boolean;
    setTouched: (arg: boolean) => void;
  };
  pharmacies: {
    value: string[];
    set: (arg: string[]) => void;
    options: Pharmacy[];
    setOptions: (arg: Pharmacy[]) => void;
  };
  mobileNumber: {
    value: string;
    set: (arg: string) => void;
    touched: boolean;
    setTouched: (arg: boolean) => void;
  };
};

// GOTCHA: https://stackoverflow.com/questions/61333188/react-typescript-avoid-context-default-value
// @ts-ignore: Expects a default value
export const NotifierFormContext = createContext<NotifierFormContextType>();

// very simple regexp
const ZIP_CODE_REG_EXP = /^[0-9]{5}$/;
const MAX_PHARMACIES = 3;
const PHONE_NUMBER_REG_EXP = /^[0-9]{3}[0-9]{3}[0-9]{4}$/;

const NotifierFormStepOne: WizardStep = ({ index, setIndex }) => {
  const { zipCode, pharmacies } = useContext(NotifierFormContext);
  const [submitting, setSubmitting] = useState(false);

  const zipCodeValid = ZIP_CODE_REG_EXP.test(zipCode.value);

  const zipCodeFieldClassName = zipCodeValid
    ? styles.validField
    : zipCode.touched
    ? styles.invalidField
    : undefined;

  const zipCodeMessageClassName = zipCodeValid
    ? styles.validMessage
    : zipCode.touched
    ? styles.invalidMessage
    : undefined;

  const next = async () => {
    try {
      setSubmitting(true);
      const res = await axios(
        `https://dev-api.vaccinenotifier.org/notifier/v1/pharmacies?zipcode=${zipCode.value}`,
      );
      // TODO: Don't assume companyName is always RiteAid, don't assume store is
      // in 'data' key.
      if (!(res.data.data.pharmacies.riteAid instanceof Array)) {
        throw new Error(
          `Unexpected JSON data structure: ${JSON.stringify(res.data)}`,
        );
      }
      pharmacies.setOptions(
        res.data.data.pharmacies.riteAid.map((p: Pharmacy) => ({
          ...p,
          companyName: 'RiteAid',
        })),
      );
      setIndex(index + 1);
    } catch (e) {
      alert(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Step {index + 1}: Zip Code</h2>
      <p>Please enter your home zip code.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          zipCode.setTouched(true);
          if (zipCodeValid) {
            next();
          }
        }}
        className={styles.form}
      >
        <input
          className={zipCodeFieldClassName}
          name="zipCode"
          type="text"
          pattern="\d*"
          inputMode="numeric"
          value={zipCode.value}
          onChange={(e) => zipCode.set(e.target.value)}
          onBlur={zipCode.setTouched.bind(null, true)}
          placeholder="97214"
          onKeyDown={(e) => {
            if (e.code === 'Enter') {
              zipCode.setTouched(true);
            }
          }}
        />
        <span className={zipCodeMessageClassName}>
          {' '}
          {zipCodeValid ? (
            '✓ Valid'
          ) : zipCode.touched ? (
            '✘ ' +
            (zipCode.value.length === 0
              ? 'Cannot be blank'
              : 'Malformed zip code')
          ) : (
            <>&nbsp;</>
          )}
        </span>
        <br />
        <br />
        <div>
          <input type="submit" value="Next" disabled={submitting} />
        </div>
      </form>
    </div>
  );
};

const NotifierFormStepTwo: WizardStep = ({ index, setIndex }) => {
  const { pharmacies, zipCode } = useContext(NotifierFormContext);
  const pharmaciesValidMin = pharmacies.value.length > 0;
  const pharmaciesValidMax = pharmacies.value.length <= MAX_PHARMACIES;
  const back = () => {
    pharmacies.set([]);
    pharmacies.setOptions([]);
    setIndex(index - 1);
  };
  const next = () => {
    if (pharmaciesValidMin && pharmaciesValidMax) {
      setIndex(index + 1);
    } else {
      alert('Please select at least one store');
    }
  };
  return (
    <div>
      <h2>Step {index + 1}: Pharmacies</h2>
      {pharmacies.options.length > 0 ? (
        <div>
          <p>
            Select up to {MAX_PHARMACIES} stores for which you would like to
            receive vaccine availability notifications.
          </p>
          <ol className={styles.storeList}>
            {pharmacies.options.map((option) => {
              const checked = pharmacies.value.includes(option.storeId);
              const disabled =
                !checked && pharmacies.value.length >= MAX_PHARMACIES;
              return (
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) =>
                        e.target.checked
                          ? pharmacies.set(
                              pharmacies.value.concat([option.storeId]),
                            )
                          : pharmacies.set(
                              pharmacies.value.filter(
                                (p) => p !== option.storeId,
                              ),
                            )
                      }
                    />{' '}
                    <span className={disabled ? styles.disabled : undefined}>
                      RiteAid at {option.address}
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div>
          No pharmacies found in {zipCode.value}.<br />
          <br />
          Please try a different zip code.
        </div>
      )}
      <br />
      <button onClick={back}>Back</button> <button onClick={next}>Next</button>
    </div>
  );
};

const NotifierFormStepThree: WizardStep = ({ index, setIndex }) => {
  const { mobileNumber, pharmacies } = useContext(NotifierFormContext);
  const [submitting, setSubmitting] = useState(false);
  const mobileNumberValid = PHONE_NUMBER_REG_EXP.test(mobileNumber.value);
  const mobileNumberFieldClassName = mobileNumberValid
    ? styles.validField
    : mobileNumber.touched
    ? styles.invalidField
    : undefined;

  const mobileNumberMessageClassName = mobileNumberValid
    ? styles.validMessage
    : mobileNumber.touched
    ? styles.invalidMessage
    : undefined;

  const back = () => {
    setIndex(index - 1);
  };
  const subscribe = async () => {
    try {
      setSubmitting(true);
      const res = await axios.post(
        'https://dev-api.vaccinenotifier.org/notifier/v1/subscribe',
        {
          phone: mobileNumber.value,
          pharmacies: {
            riteAid: pharmacies.options
              .filter((o) => pharmacies.value.indexOf(o.storeId) !== -1)
              .map((p) => ({ storeId: p.storeId, address: p.address })),
          },
        },
      );
      alert(`${res.status}: ${res.statusText}`);
    } catch (e) {
      alert(e);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div>
      <h2>Step {index + 1}: Mobile #</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mobileNumber.setTouched(true);
          if (mobileNumberValid) {
            subscribe();
          }
        }}
        className={styles.form}
      >
        <input
          className={mobileNumberFieldClassName}
          name="mobileNumber"
          type="tel"
          pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
          inputMode="numeric"
          value={mobileNumber.value}
          onChange={(e) => mobileNumber.set(e.target.value)}
          onBlur={mobileNumber.setTouched.bind(null, true)}
          placeholder="5039783245"
          onKeyDown={(e) => {
            if (e.code === 'Enter') {
              mobileNumber.setTouched(true);
            }
          }}
        />
        <span className={mobileNumberMessageClassName}>
          {' '}
          {mobileNumberValid ? (
            '✓ Valid'
          ) : mobileNumber.touched ? (
            '✘ ' +
            (mobileNumber.value.length === 0
              ? 'Cannot be blank'
              : 'Malformed phone number')
          ) : (
            <>&nbsp;</>
          )}
        </span>
        <br />
        <br />
        <button onClick={back}>Back</button>{' '}
        <input type="submit" value="Subscribe" disabled={submitting} />
      </form>
    </div>
  );
};

const NotifierFormSteps = [
  NotifierFormStepOne,
  NotifierFormStepTwo,
  NotifierFormStepThree,
];

export const NotifierForm = () => {
  console.log('Rendering notifier form component...');
  const [zipCode, setZipCode] = useState('');
  const [zipCodeTouched, setZipCodeTouched] = useState(false);
  const [pharmacies, setPharmacies] = useState([] as string[]);
  const [pharmacyOptions, setPharmacyOptions] = useState([] as Pharmacy[]);
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileNumberTouched, setMobileNumberTouched] = useState(false);
  return (
    <div id="NotifierForm">
      <NotifierFormContext.Provider
        value={{
          zipCode: {
            value: zipCode,
            set: setZipCode,
            touched: zipCodeTouched,
            setTouched: setZipCodeTouched,
          },
          pharmacies: {
            value: pharmacies,
            set: setPharmacies,
            options: pharmacyOptions,
            setOptions: setPharmacyOptions,
          },
          mobileNumber: {
            value: mobileNumber,
            set: setMobileNumber,
            touched: mobileNumberTouched,
            setTouched: setMobileNumberTouched,
          },
        }}
      >
        <Wizard steps={NotifierFormSteps} />
      </NotifierFormContext.Provider>
    </div>
  );
};
