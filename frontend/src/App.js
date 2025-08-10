
import DailyLogVisualizer from './components/ELDLogs';
import RouteInstructions from './components/RouteInstructions';
import { BrowserRouter as Router,Routes,Route } from 'react-router-dom';
import TripForm from './components/TripForm';
import { TripProvider } from './TripContext';


function App() {
  return (
    <TripProvider>
      <Router>
        <Routes>
          <Route path="/" element={<TripForm />} />
          <Route path="/eld-log" element={<DailyLogVisualizer />} />
          <Route path="/route-instructions" element={<RouteInstructions />} />
        </Routes>
      </Router>
    </TripProvider>
  );
}

export default App;