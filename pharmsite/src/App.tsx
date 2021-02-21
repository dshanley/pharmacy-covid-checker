import React from 'react';
import { NotifierForm } from './Components/NotifierForm';

const App = () => {
  return (
    <div className="App">
      <div className="container">
        <header className="App-header">
          <div className="row">
            <div className="col-8 col-push-2">
              <div className="logo">
                <img src="logo.png" />
              </div>
              <h1>Vaccine Notifier</h1>
              <h3>
                Get text alerts when COVID-19 vaccines become available at your local
                pharmacy.
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
        
        <footer>
          <br />
        </footer>
      </div>
    </div>
  );
};

export default App;
