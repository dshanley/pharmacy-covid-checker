
const RITE_AID_CHECK_URL = "https://www.riteaid.com/services/ext/v2/vaccine/checkSlots?storeNumber=";

const BRAND = {
  RITEAID_STORE: "riteaid",
  RITEAID_URL: "http://riteaid.com/pharmacy/apt-scheduler"
};

// subscription time is in days
const SUBSCRIPTION = {
  EXPIRATION: 7, 
  DISPLAY_NAME: "VaccineNotifier.org"

}

module.exports = {
  BRAND,
  RITE_AID_CHECK_URL,
  SUBSCRIPTION
}

