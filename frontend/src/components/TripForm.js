import { useState,useEffect } from 'react';
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Stack
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../TripContext';
import axios from 'axios'

// Hardcoded testRouteData
const testRouteData = {
  current_location: "Hawassa, Ethiopia",
  origin: "Nairobi, Kenya",
  destination: "Mekele, Ethiopia",
  total_distance_miles: 2093.40,
  total_duration_hours: 75.31,
  driverName: "John Doe",
  truckId: "TRK-12345",
  planned_stops: [
    {
      day: 1,
      type: "Driving (to Origin)",
      duration_hours: 11,
      distance_miles: 531.6561393143874,
      description: "Driving for 11.00 hours to reach Nairobi, Kenya.",
      coordinates: [-1.2921, 36.8219]
    },
    {
      day: 1,
      type: "Daily Rest",
      duration_hours: 10,
      description: "Mandatory 10-hour daily rest near Wamba West ward.",
      coordinates: [0.8577, 37.5972]
    },
    {
      day: 2,
      type: "Driving (to Origin)",
      duration_hours: 4.377583333333334,
      distance_miles: 211.57900495700068,
      description: "Driving for 4.38 hours to reach Nairobi, Kenya.",
      coordinates: [1.2921, 36.8219]
    },
    {
      day: 2,
      type: "Pickup Stop",
      duration_hours: 1,
      description: "One-hour stop for picking up the load at Nairobi, Kenya.",
      coordinates: [-1.2921, 36.8219]
    },
    {
      day: 2,
      type: "Refueling Stop",
      duration_hours: 0.5,
      description: "Refueling stop at coordinates 4.46, 37.85 after driving approximately 1274.89 miles.",
      coordinates: [4.46, 37.85]
    },
    {
      day: 2,
      type: "Driving (to Destination)",
      duration_hours: 11,
      distance_miles: 531.6561393143874,
      description: "Driving for 11.00 hours to the final destination.",
      coordinates: [7.063, 38.476]
    },
    {
      day: 2,
      type: "Daily Rest",
      duration_hours: 10,
      description: "Mandatory 10-hour daily rest at coordinates 4.46, 37.85.",
      coordinates: [4.46, 37.85]
    },
    {
      day: 3,
      type: "Driving (to Destination)",
      duration_hours: 11,
      distance_miles: 531.6561393143874,
      description: "Driving for 11.00 hours to the final destination.",
      coordinates: [10.21, 38.88]
    },
    {
      day: 3,
      type: "Daily Rest",
      duration_hours: 10,
      description: "Mandatory 10-hour daily rest at coordinates 10.21, 38.88.",
      coordinates: [10.21, 38.88]
    },
    {
      day: 4,
      type: "Driving (to Destination)",
      duration_hours: 5.435055555555554,
      distance_miles: 262.68915032962536,
      description: "Driving for 5.44 hours to the final destination.",
      coordinates: [13.4967, 39.4753]
    },
    {
      day: 4,
      type: "Drop-off Stop",
      duration_hours: 1,
      description: "One-hour stop for dropping off the load at Mekele, Ethiopia.",
      coordinates: [13.4967, 39.4753]
    }
  ]
};

function TripForm() {
  const navigate = useNavigate();
  const { setTrip } = useTrip();

   // Load form state from localStorage if available
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('tripForm');
    return saved
      ? JSON.parse(saved)
      : {
          current_location: '',
          pickup_location: '',
          dropoff_location: '',
        };
    });

  useEffect(() => {
    localStorage.setItem('tripForm', JSON.stringify(form));
  }, [form]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleClear = () => {
    setForm({
      current_location: '',
      pickup_location: '',
      dropoff_location: '',
    });
  };
const fetchTripData = async (redirectPath) => {
  // Prevent request if any field is empty
  if (
    !form.current_location.trim() ||
    !form.pickup_location.trim() ||
    !form.dropoff_location.trim()
  ) {
    alert('Please fill in all fields.');
    return;
  }
  try {
    const response = await axios.post(
      'http://localhost:8000/plan-trip/',
      {
        current_location: form.current_location,
        origin: form.pickup_location,
        destination: form.dropoff_location,
        current_cycle_hours: [8, 9, 10, 8, 7, 9, 6, 5],
      },
      { timeout: 60000 }
    );
    if (response.status === 200) {
      setTrip(response.data);
    } else {
      setTrip(testRouteData);
    }
  } catch (err) {
    setTrip(testRouteData);
  }
  navigate(redirectPath);
};
  const handleInstruction = (e) => {
    e.preventDefault();
    fetchTripData('/route-instructions');
  };

  const handleELD = (e) => {
    e.preventDefault();
    fetchTripData('/eld-log');
  };


  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', py: 8 }}>
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(60,60,60,0.15)' }}>
          <Box mb={3}>
            <Typography variant="h4" align="center" gutterBottom>
              Trip Planner
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle1"><strong>Driver:</strong> John Doe</Typography>
              <Typography variant="subtitle1"><strong>Truck ID:</strong> TRK-12345</Typography>
            </Box>
            <Typography variant="subtitle2" color="text.secondary" align="right" mb={2}>
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Current Cycle (hours driven in past 8 days):</strong>
          </Alert>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[8, 9, 10, 8, 7, 9, 6, 5].map((_, idx) => (
                    <TableCell key={idx} align="center">Day {idx + 1}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {[8, 9, 10, 8, 7, 9, 6, 5].map((hours, idx) => (
                    <TableCell key={idx} align="center">{hours}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <div>
            <form>
              <TextField
                label="Current Location"
                name="current_location"
                value={form.current_location}
                onChange={handleChange}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Pickup Location"
                name="pickup_location"
                value={form.pickup_location}
                onChange={handleChange}
                fullWidth
                margin="normal"
                required
              />
              <TextField
                label="Dropoff Location"
                name="dropoff_location"
                value={form.dropoff_location}
                onChange={handleChange}
                fullWidth
                margin="normal"
                required
              />
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleClear}
                  fullWidth
                >
                  Clear
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleInstruction}
                  fullWidth
                >
                  Generate Instruction
                </Button>
                <Button
                  variant="contained"
                  color="info"
                  onClick={handleELD}
                  fullWidth
                >
                  Generate ELD
                </Button>
              </Stack>
            </form>
          </div>
        </Paper>
      </Container>
    </Box>
  );
}

export default TripForm;