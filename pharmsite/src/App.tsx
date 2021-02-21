import React from 'react';
import { NotifierForm } from './Components/NotifierForm';

const App = () => {
  return (
    <div className="App">
      <div className="container">
        <header className="App-header">
          <div className="row">
            <div className="col-12">
              <div className="logo">
                <h1>
                  <a href="/"><img src="logo.png" alt="Vaccine Notifier"/></a>
                  <br/>
                  Vaccine Notifier
                </h1>
              </div>
              <h3 className="center">
                Get text alerts when a pharmacy near you has available COVID-19 vaccines.
              </h3>
            </div>
          </div>
        </header>
      
        <main role="main">
          <div className="row">
            <div className="col-8 col-push-2 center">
              <NotifierForm />
            </div>
          </div>
        </main>
    
        <div className="center">
          <img src="city.png" alt="Vaccine Notifier" className="city"/>
        </div>
      </div>
    
      <section className="info-block">
        <div className="container">
          <div className="row">
            <div className="col-10 col-push-1">
              <h4>How it works</h4>
              <p>                
                When it's your turn to get the COVID-19 vaccine, don't waste your time calling up every pharmacy trying to schedule an appointment.
                Subscribe to the Vaccine Notifier and you'll be notified when your local pharmacy has vaccines in supply, making it easy to
                schedule an appointment.
              </p>
              <p>
                If you are unsure on your vaccince eligibility status, the Wall Street Journal is maintaining <a href="https://www.wsj.com/amp/articles/how-to-get-a-covid-19-vaccine-a-state-by-state-guide-11611703769" target="_blank">up-to-date guidelines</a> for each state.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      <footer>
        <div className="container">
          <div className="row">
            <div className="col-10 col-push-1">
              Made in Portland
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
