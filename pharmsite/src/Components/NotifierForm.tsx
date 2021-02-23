import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Wizard, WizardStep } from './Wizard';
import styles from './NotifierForm.module.scss';
import axios from 'axios';
import Inputmask from 'inputmask';

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

const ZIP_CODE_MASK = new Inputmask('99999');
const PHONE_NUMBER_MASK = new Inputmask('999-999-9999');

// very simple regexp
const ZIP_CODE_REG_EXP = /^[0-9]{5}$/; // GOTCHA: slightly different from pattern!
// const MAX_PHARMACIES = 100; // NOTE: Uncomment to enable maximum # of pharmacies
const PHONE_NUMBER_REG_EXP = /^[0-9]{3}-[0-9]{3}-[0-9]{4}$/;

const LOADING_STRING = 'Loading...';

const NotifierFormStepOne: WizardStep = ({ index, back, forward }) => {
  const { zipCode, pharmacies } = useContext(NotifierFormContext);
  const [submitting, setSubmitting] = useState(false);

  const inputEl = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputEl.current) {
      ZIP_CODE_MASK.mask(inputEl.current);
    }
  }, []);

  const zipCodeValid = ZIP_CODE_REG_EXP.test(zipCode.value);

  const zipCodeFieldClassName = zipCodeValid
    ? styles.validField
    : zipCode.touched
    ? styles.invalidField
    : undefined;

  // const zipCodeMessageClassName = zipCodeValid
  //   ? styles.validMessage
  //   : zipCode.touched
  //   ? styles.invalidMessage
  //   : undefined;

  const next = async () => {
    try {
      setSubmitting(true);
      const res = await axios(
        `${process.env.REACT_APP_SERVER_URL}/notifier/v1/pharmacies?zipcode=${zipCode.value}`,
      );
      // TODO: Don't assume companyName is always RiteAid, don't assume store is
      // in 'data' key.
      if (!(res.data.data.pharmacies.riteAid instanceof Array)) {
        throw new Error(
          `Unexpected JSON data structure: ${JSON.stringify(res.data)}`,
        );
      }

      if (res.data.data.pharmacies.riteAid.length === 0) {
        throw new Error(
          `No pharmacies found in ${zipCode.value}. Please try a different zip code.`,
        );
      }

      const nextOptions: Pharmacy[] = res.data.data.pharmacies.riteAid.map(
        (p: Pharmacy) => ({
          ...p,
          companyName: 'RiteAid',
        }),
      );

      pharmacies.set([]);
      pharmacies.setOptions(nextOptions);
      forward()
    } catch (e) {
      alert(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Enter your ZIP code to get started</h2>
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
          ref={inputEl}
          className={zipCodeFieldClassName}
          name="zipCode"
          type="text"
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
        <br />
        <br />
        <div>
          <input
            type="submit"
            className="btn"
            value={submitting ? LOADING_STRING : 'Find pharmacies'}
            disabled={submitting}
          />
        </div>
      </form>
    </div>
  );
};

const NotifierFormStepTwo: WizardStep = ({ index, back, forward }) => {
  const { pharmacies } = useContext(NotifierFormContext);
  const pharmaciesValidMin = pharmacies.value.length > 0;
  // // NOTE: Uncomment to enable maximum # of pharmacies
  // const pharmaciesValidMax = pharmacies.value.length <= MAX_PHARMACIES;
  const next = () => {
    // // NOTE: Uncomment to enable maximum # of pharmacies
    // if (pharmaciesValidMin && pharmaciesValidMax) {
    if (pharmaciesValidMin) {
      forward()
    } else {
      alert('Please select at least one store');
    }
  };
  return (
    <div>
      <h2>Pharmacies near you</h2>
      <div>
        <p>
          Select the stores for which you would like to receive vaccine
          availability notifications.
        </p>
        <ol className={styles.storeList}>
          {pharmacies.options.map((option) => {
            const checked = pharmacies.value.includes(option.storeId);
            // // NOTE: Uncomment to enable maximum # of pharmacies
            // const disabled = !checked && pharmacies.value.length >= MAX_PHARMACIES;
            const disabled = false;
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
                  <div className="storeAddress">
                    <span className={disabled ? styles.disabled : undefined}>
                      <strong>RiteAid</strong>
                      <br />
                      {option.address}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
        </ol>
      </div>
      <br />
      <button className="btn-ghost" onClick={back}>
        Back
      </button>{' '}
      <button className="btn" onClick={next}>
        Next
      </button>
    </div>
  );
};

const NotifierFormStepThree: WizardStep = ({ index, forward, back }) => {
  const { mobileNumber, pharmacies } = useContext(NotifierFormContext);
  const [submitting, setSubmitting] = useState(false);
  const mobileNumberValid = PHONE_NUMBER_REG_EXP.test(mobileNumber.value);

  const inputEl = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputEl.current) {
      PHONE_NUMBER_MASK.mask(inputEl.current);
    }
  }, []);

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

  const subscribe = async () => {
    try {
      setSubmitting(true);
      const res = await axios.post(
        `${process.env.REACT_APP_SERVER_URL}/notifier/v1/subscribe`,
        {
          phone: mobileNumber.value,
          pharmacies: {
            riteAid: pharmacies.options
              .filter((o) => pharmacies.value.indexOf(o.storeId) !== -1)
              .map((p) => ({ storeId: p.storeId, address: p.address })),
          },
        },
      );
      if (res.status === 200) {
        forward()
      } else {
        throw new Error(`status: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      alert(e);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div>
      <h2>Enter your mobile number</h2>
        <p>
          You will receive a text message confirming your subscription.
        </p>
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
          ref={inputEl}
          className={mobileNumberFieldClassName}
          name="mobile"
          type="tel"
          autoComplete="tel-national"
          inputMode="numeric"
          value={mobileNumber.value}
          onChange={(e) => mobileNumber.set(e.target.value)}
          onBlur={mobileNumber.setTouched.bind(null, true)}
          onKeyDown={(e) => {
            if (e.code === 'Enter') {
              mobileNumber.setTouched(true);
            }
          }}
        />
        <br />
        <span className={mobileNumberMessageClassName}>
          {' '}
          {mobileNumberValid ? (
            '✓ Valid phone number'
          ) : mobileNumber.touched ? (
            '✘ ' +
            (mobileNumber.value.length === 0
              ? 'Cannot be blank'
              : 'Invalid phone number')
          ) : (
            <>&nbsp;</>
          )}
        </span>
        <br />
        <br />
        <button type="button" className="btn-ghost" onClick={back}>
          Back
        </button>{' '}
        <input
          type="submit"
          className="btn"
          value={submitting ? LOADING_STRING : 'Subscribe'}
          disabled={submitting}
        />
      </form>
    </div>
  );
};

const NotifierFormStepFour = () => {
  const restart = () => {
    window.location.reload();
  };
  return (
    <div>
      <h2>Success</h2>
      <ul className="nobullet">
        <li>You'll get a text message now to confirm you're subscribed.</li>
        <li>We'll notify you when vaccine becomes available at a store.</li>
        <li>Follow the link to qualify and register your spot.</li>
      </ul>
      <button className="btn" onClick={restart}>
        Start Over
      </button>
    </div>
  );
};

const NotifierFormSteps = [
  NotifierFormStepOne,
  NotifierFormStepTwo,
  NotifierFormStepThree,
  NotifierFormStepFour,
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
