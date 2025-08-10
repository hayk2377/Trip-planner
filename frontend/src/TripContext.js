import { createContext, useContext, useState } from 'react';

const TripContext = createContext();

export function useTrip() {
  return useContext(TripContext);
}

export function TripProvider({ children }) {
  const [tripData, setTripData] = useState(null);

  // Call this after getting tripData from backend
  const setTrip = (data) => setTripData(data);

  return (
    <TripContext.Provider value={{ tripData, setTrip }}>
      {children}
    </TripContext.Provider>
  );
}