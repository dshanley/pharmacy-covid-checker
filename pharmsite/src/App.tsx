import React from 'react';
import { NotifierForm } from './Components/NotifierForm';

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
        <NotifierForm />
      </main>
    </div>
  );
};

export default App;
