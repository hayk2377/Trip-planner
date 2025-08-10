import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import L from 'leaflet';
import { Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText, Divider, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import pickupIcon from '../icons/pickup.png';
import refuelIcon from '../icons/refuel.png';
import restIcon from '../icons/rest.png';
import dropoffIcon from '../icons/destination.png';
import { useTrip } from '../TripContext';

const getCustomIcon = (type) => {
  let iconUrl = pickupIcon; // default

  switch (type) {
    case 'start':
      iconUrl = pickupIcon;
      break;
    case 'end':
    case 'Drop-off Stop':
      iconUrl = dropoffIcon;
      break;
    case 'Pickup Stop':
      iconUrl = pickupIcon;
      break;
    case 'Refueling Stop':
      iconUrl = refuelIcon;
      break;
    case 'Daily Rest':
      iconUrl = restIcon;
      break;
    default:
      iconUrl = restIcon;
  }

  return new L.Icon({
    iconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'mui-map-icon'
  });
};

const MapUpdater = ({ routeCoordinates, stops }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || (routeCoordinates.length === 0 && stops.length === 0)) {
      return;
    }

    const allCoordinates = [
      ...routeCoordinates,
      ...stops.map(stop => stop.coordinates)
    ];

    if (allCoordinates.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(allCoordinates);
    map.fitBounds(bounds, { padding: [50, 50] });

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map, routeCoordinates, stops]);

  return null;
};
const RouteInstructions = () => {
  const { tripData } = useTrip();
  const navigate = useNavigate();
  const polylineOptions = useMemo(() => ({
    color: '#1976d2',
    weight: 5,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round',
  }), []);

  if (!tripData) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          No trip planned yet.
        </Typography>
      </Box>
    );
  }

  const route = tripData;
  const plannedStops = tripData.planned_stops;

  const pathCoords = plannedStops.map(stop => stop.coordinates);
  const stopsData = plannedStops;
  const firstStopCoords = stopsData[0]?.coordinates;

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'linear-gradient(135deg, #e3f2fd 0%, #f4f6f8 100%)',
      py: 6,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start'
    }}>
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 1050,
          borderRadius: 5,
          p: { xs: 2, sm: 5 },
          boxShadow: '0 8px 32px 0 rgba(25, 118, 210, 0.10)',
          bgcolor: '#fff',
        }}
      >
        {/* Navigation Buttons */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate('/')}
          >
            Back to Form
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/eld-log')}
          >
            Show ELD Logs
          </Button>

        </Stack>

        {/* Route Summary */}
        <Box sx={{
          mb: 4,
          p: 3,
          borderRadius: 3,
          bgcolor: 'rgba(25, 118, 210, 0.07)',
          boxShadow: '0 2px 8px 0 rgba(25, 118, 210, 0.04)'
        }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 700 }}>
            Route Summary
          </Typography>
          <Divider sx={{ my: 1, borderColor: 'primary.light' }} />
          <Typography sx={{ mb: 0.5 }}><strong>From:</strong> {route.origin}</Typography>
          <Typography sx={{ mb: 0.5 }}><strong>To:</strong> {route.destination}</Typography>
          <Typography sx={{ mb: 0.5 }}><strong>Total Distance:</strong> {route.total_distance_miles.toFixed(2)} miles</Typography>
          <Typography><strong>Total Duration:</strong> {route.total_duration_hours.toFixed(2)} hours</Typography>
        </Box>


        <Box sx={{
          mb: 4,
          p: 3,
          borderRadius: 3,
          bgcolor: 'rgba(33, 150, 243, 0.06)',
          boxShadow: '0 2px 8px 0 rgba(33, 150, 243, 0.04)'
        }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.dark', fontWeight: 600 }}>
            Planned Actions
          </Typography>
          <Divider sx={{ my: 1, borderColor: 'primary.light' }} />
          <List dense>
            {stopsData.map((stop, idx) => {
              const IconComponent = () => {
                let iconType;
                if (idx === 0) iconType = 'start';
                else if (idx === stopsData.length - 1) iconType = 'end';
                else iconType = stop.type;

                const customIcon = getCustomIcon(iconType);
                return (
                  <div dangerouslySetInnerHTML={{ __html: customIcon.options.html }} />
                );
              };

              return (
                <ListItem
                  key={idx}
                  sx={{
                    alignItems: 'flex-start',
                    py: 1.5,
                    borderRadius: 2,
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' }
                  }}
                  secondaryAction={
                    <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                      {stop.duration_hours && (
                        <Typography variant="caption" color="primary" display="block">
                          {stop.duration_hours.toFixed(2)} h
                        </Typography>
                      )}
                      {stop.distance_miles && (
                        <Typography variant="caption" color="primary" display="block">
                          {stop.distance_miles.toFixed(2)} mi
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <ListItemIcon sx={{ mt: 0.5, minWidth: 36 }}>
                    <IconComponent />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                        {stop.type}
                      </Typography>
                    }
                    secondary={
                      <Typography component="span" variant="body2" color="text.secondary">
                        {stop.description}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Route Map */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.dark', fontWeight: 600 }}>
            Route Map
          </Typography>
          <Divider sx={{ my: 1, borderColor: 'primary.light' }} />
          <Paper elevation={2} sx={{ height: '340px', borderRadius: 3, overflow: 'hidden', bgcolor: '#e3f2fd' }}>
            <MapContainer
              center={firstStopCoords || [0, 0]}
              zoom={firstStopCoords ? 7 : 2}
              scrollWheelZoom={true}
              zoomSnap={0.5}
              wheelDebounceTime={100}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* MapUpdater to fit bounds */}
              <MapUpdater routeCoordinates={pathCoords} stops={stopsData} />

              {/* Render the Polyline for the route */}
              {pathCoords.length > 1 && (
                <Polyline positions={pathCoords} pathOptions={polylineOptions} />
              )}

              {/* Render markers for planned stops */}
              {stopsData.map((stop, index) => {
                let icon;
                if (index === 0) icon = getCustomIcon('start');
                else if (index === stopsData.length - 1) icon = getCustomIcon('end');
                else icon = getCustomIcon(stop.type);

                return (
                  <Marker
                    key={index}
                    position={stop.coordinates}
                    icon={icon}
                  >
                    <Popup>
                      <Typography variant="h6">{stop.type}</Typography>
                      <Typography>{stop.description}</Typography>
                      {stop.duration_hours && <Typography>Duration: {stop.duration_hours.toFixed(2)} hrs</Typography>}
                      {stop.distance_miles && <Typography>Distance: {stop.distance_miles.toFixed(2)} miles</Typography>}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
};

export default RouteInstructions;