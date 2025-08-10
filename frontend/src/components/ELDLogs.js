import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, Grid, TextField, ThemeProvider, createTheme, CssBaseline, Table, TableBody, TableCell, TableContainer, TableHead, TableRow ,Stack,Button} from '@mui/material';
import { format, addHours, startOfDay, isBefore, addDays, differenceInHours, min } from 'date-fns';
import { useTrip } from '../TripContext';
import { useNavigate } from 'react-router-dom';

// Helper function for ELD status mapping
const ELD_STATUS_MAP = {
    'Driving (to Origin)': 'Driving',
    'Driving (to Destination)': 'Driving',
    'Driving': 'Driving',
    'Daily Rest': 'Off Duty',
    'Pickup Stop': 'On Duty (Not Driving)',
    'Refueling Stop': 'On Duty (Not Driving)',
    'Drop-off Stop': 'On Duty (Not Driving)',
};

// Define duty statuses for the chart rows and their mapping to Y-coordinates
const dutyStatuses = ['Off Duty', 'Sleeper Birth', 'Driving', 'On Duty (Not Driving)'];
const dutyStatusMap = {
    'Off Duty': 0,
    'Sleeper Birth': 1,
    'Driving': 2,
    'On Duty (Not Driving)': 3,
};

/**
 * Processes trip data to generate daily ELD log segments and summaries.
 * It handles activities spanning multiple days and fills in 'Off Duty' gaps.
 * @param {Array} plannedStops - Array of planned stop objects with type and duration_hours.
 * @param {Date} startDate - The actual start Date object for the trip.
 * @returns {Object} An object where keys are formatted dates (YYYY-MM-DD) and values contain
 *                   'segments' (for chart visualization) and 'summary' (aggregated hours).
 */
const processTripData = (plannedStops, startDate) => {
    const dailyData = {}; // Stores { 'YYYY-MM-DD': { segments:[], summary: {} } }
    let currentAbsoluteTime = startDate; // Tracks the cumulative time through the trip

    plannedStops.forEach(stop => {
        const activityType = stop.type;
        const durationHours = stop.duration_hours;
        const eldStatus = ELD_STATUS_MAP[activityType] || 'Off Duty'; // Default to Off Duty if not mapped

        let activityStartTime = currentAbsoluteTime;
        let activityEndTime = addHours(currentAbsoluteTime, durationHours);

        let tempCurrentTime = activityStartTime;

        // Loop to handle activities that span across multiple calendar days
        while (isBefore(tempCurrentTime, activityEndTime)) {
            const currentDayStart = startOfDay(tempCurrentTime);
            const nextDayStart = addDays(currentDayStart, 1);
            const dayEndForSegment = min([activityEndTime, nextDayStart]); // The end time for the segment within the current day

            const currentDayFormatted = format(currentDayStart, 'yyyy-MM-dd');

            if (!dailyData[currentDayFormatted]) {
                dailyData[currentDayFormatted] = {
                    segments: [],
                    summary: { 'Off Duty': 0, 'Sleeper Birth': 0, 'Driving': 0, 'On Duty (Not Driving)': 0 },
                };
            }

            // Calculate start and end hours relative to the current day's midnight
            const segmentStartHour = differenceInHours(tempCurrentTime, currentDayStart);
            const segmentEndHour = differenceInHours(dayEndForSegment, currentDayStart);
            const segmentDuration = segmentEndHour - segmentStartHour;

            if (segmentDuration > 0) { // Only add if there's actual duration for the segment
                dailyData[currentDayFormatted].segments.push({
                    status: eldStatus,
                    startHour: segmentStartHour,
                    endHour: segmentEndHour,
                });
            }

            tempCurrentTime = nextDayStart; // Move to the start of the next calendar day
        }
        currentAbsoluteTime = activityEndTime; // Update cumulative time for the next activity
    });

    // Post-processing for each day: fill gaps with 'Off Duty' and merge contiguous segments
    for (const dateKey in dailyData) {
        let segments = dailyData[dateKey].segments;

        // Sort segments by startHour to ensure correct processing order
        segments.sort((a, b) => a.startHour - b.startHour);

        // Fill gaps with 'Off Duty' segments
        const filledSegments = [];
        let currentHourPointer = 0;
        segments.forEach(segment => {
            const actualSegmentStart = Math.max(currentHourPointer, segment.startHour);
            if (actualSegmentStart > currentHourPointer) {
                filledSegments.push({
                    status: 'Off Duty',
                    startHour: currentHourPointer,
                    endHour: actualSegmentStart,
                });
            }
            filledSegments.push({
                status: segment.status,
                startHour: actualSegmentStart,
                endHour: Math.min(24, segment.endHour),
            });
            currentHourPointer = Math.min(24, segment.endHour);
        });
        if (currentHourPointer < 24) {
            filledSegments.push({
                status: 'Off Duty',
                startHour: currentHourPointer,
                endHour: 24,
            });
        }

        // Merge contiguous segments of the same status
        const mergedSegments = [];
        if (filledSegments.length > 0) {
            let currentMerged = { ...filledSegments[0] };
            for (let i = 1; i < filledSegments.length; i++) {
                const nextSegment = filledSegments[i];
                if (currentMerged.status === nextSegment.status && Math.abs(currentMerged.endHour - nextSegment.startHour) < 0.001) {
                    currentMerged.endHour = nextSegment.endHour;
                } else {
                    mergedSegments.push(currentMerged);
                    currentMerged = { ...nextSegment };
                }
            }
            mergedSegments.push(currentMerged);
        }
        dailyData[dateKey].segments = mergedSegments;

        // Recalculate summary from mergedSegments to ensure all hours are counted
        const summary = { 'Off Duty': 0, 'Sleeper Birth': 0, 'Driving': 0, 'On Duty (Not Driving)': 0 };
        for (const seg of mergedSegments) {
            summary[seg.status] += seg.endHour - seg.startHour;
        }
        for (const status in summary) {
            summary[status] = parseFloat(summary[status].toFixed(2));
        }
        dailyData[dateKey].summary = summary;
    }

    return dailyData;
};

const DailySummaryTable = ({ date, summaryData }) => {
    // Merge Off Duty and Sleeper Birth for display
    const mergedSummary = {
        'Off Duty': (summaryData['Off Duty'] || 0) + (summaryData['Sleeper Birth'] || 0),
        'Driving': summaryData['Driving'] || 0,
        'On Duty (Not Driving)': summaryData['On Duty (Not Driving)'] || 0,
    };

    // Ensure total is 24 (fix for floating point rounding)
    const total = Object.values(mergedSummary).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 24) > 0.01) {
        mergedSummary['Off Duty'] += 24 - total;
        mergedSummary['Off Duty'] = parseFloat(mergedSummary['Off Duty'].toFixed(2));
    }

    return (
        <Paper elevation={1} sx={{ mt: 2, p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.dark' }}>
                Summary for {date}
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Duty Status</TableCell>
                            <TableCell align="right">Hours</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.entries(mergedSummary).map(([status, hours]) => (
                            <TableRow key={status}>
                                <TableCell>{status}</TableCell>
                                <TableCell align="right">{hours.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};
const DailyLogVisualizer = () => {
    const { tripData } = useTrip();


    const navigate=useNavigate();
    const driverName = tripData.driverName || "Unknown Driver";
    const truckId = tripData.truckId || "Unknown Truck";
    const [startDate, setStartDate] = useState(new Date('2025-08-07T08:00:00'));

    const theme = useMemo(() => createTheme({
        palette: {
            mode: 'light',
            primary: {
                main: '#1976d2',
                light: '#42a5f5',
                dark: '#1565c0',
                contrastText: '#fff',
            },
            background: {
                default: '#f4f6f8',
                paper: '#ffffff',
            },
            text: {
                primary: '#000000',
                secondary: '#555555',
            },
        },
        typography: {
            fontFamily: 'Roboto, sans-serif',
        },
        components: {
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '&.MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#1976d2' },
                            '&:hover fieldset': { borderColor: '#1565c0' },
                            '&.Mui-focused fieldset': { borderColor: '#1976d2' },
                        },
                        '&.MuiInputLabel-root': { color: '#1565c0' },
                        '&.MuiInputBase-input': { color: '#000000' },
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#e0e0e0',
                    },
                },
            },
        },
    }), []);

    const processedLogData = useMemo(() => {
        return processTripData(tripData.planned_stops, startDate);
    }, [tripData.planned_stops, startDate]);

        if (!tripData) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" color="text.secondary">
                    No trip planned yet.
                </Typography>
            </Box>
        );
    }

    // SVG dimensions for the ELD chart
    const SVG_WIDTH = 1000;
    const SVG_HEIGHT = 240;
    const ROW_HEIGHT = SVG_HEIGHT / 4; // 4 duty status rows
    const HOUR_WIDTH = SVG_WIDTH / 24; // Width per hour

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            <Box sx={{ p: 4, bgcolor: 'background.default', color: 'text.primary' }}>
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
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
                    onClick={() => navigate('/route-instructions')}
                >
                    Show Instructions
                </Button>

                </Stack>
                    <Typography variant="h4" gutterBottom align="center" sx={{ color: 'primary.main', mb: 4 }}>
                        Drivers Daily Log
                    </Typography>

                    {/* Driver and Truck Information Section */}
                    <Grid container spacing={2} mb={4}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Driver Name"
                                value={driverName}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Truck ID"
                                value={truckId}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                    </Grid>

                    {/* Trip Information Section */}
                    <Grid container spacing={2} mb={4}>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                label="Origin"
                                value={tripData.origin}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                label="Destination"
                                value={tripData.destination}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                label="Current Location"
                                value={tripData.current_location}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Total Distance (miles)"
                                value={`${parseFloat(tripData.total_distance_miles).toFixed(2)} miles`}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Total Duration (hours)"
                                value={`${parseFloat(tripData.total_duration_hours).toFixed(2)} hours`}
                                fullWidth
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                            />
                        </Grid>
                    </Grid>

                    {/* Start Date Selection */}
                    <Box mb={4}>
                        <TextField
                            label="Trip Start Date & Time"
                            type="datetime-local"
                            value={format(startDate, "yyyy-MM-dd'T'HH:mm")}
                            onChange={(e) => setStartDate(new Date(e.target.value))}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                        />
                    </Box>

                    {/* ELD Log Visualization Section - Loop for each day */}
                    {Object.entries(processedLogData).sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).map(([date, data]) => (
                        <Paper key={date} elevation={2} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
                                Daily Log for {format(new Date(date), 'PPP')}
                            </Typography>
                            <Grid container sx={{ minHeight: SVG_HEIGHT }}>
                                <Grid item xs={1} sx={{ pr: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: SVG_HEIGHT }}>
                                    {/* Labels column */}
                                    {dutyStatuses.map((status, index) => (
                                        <Typography key={status} variant="body2" sx={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 1 }}>
                                            {index + 1}. {status}
                                        </Typography>
                                    ))}
                                </Grid>
                                <Grid item xs={11} sx={{ height: SVG_HEIGHT, display: 'flex', alignItems: 'stretch' }}>
                                    {/* SVG Drawing Area */}
                                    <svg
                                        width="100%"
                                        height={SVG_HEIGHT}
                                        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                                        style={{ border: '1px solid #ccc', overflow: 'visible', display: 'block' }}
                                    >
                                        {/* Hour Labels */}
                                        {[...Array(25)].map((_, i) => {
                                            let label = '';
                                            if (i === 0) label = 'Midnight';
                                            else if (i === 12) label = 'Noon';
                                            else if (i === 24) label = 'Midnight';
                                            else if (i > 12) label = `${i - 12} PM`;
                                            else label = `${i} AM`;

                                            return (
                                                <g key={`hour-label-${i}`}>
                                                    <text
                                                        x={i * HOUR_WIDTH}
                                                        y={-10}
                                                        fontSize="10"
                                                        fill={theme.palette.text.primary}
                                                        textAnchor={i === 0 ? "start" : (i === 24 ? "end" : "middle")}
                                                        dominantBaseline="auto"
                                                    >
                                                        {label}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* Horizontal Grid Lines */}
                                        {dutyStatuses.map((_, index) => (
                                            <line
                                                key={`h-line-${index}`}
                                                x1="0"
                                                y1={index * ROW_HEIGHT}
                                                x2={SVG_WIDTH}
                                                y2={index * ROW_HEIGHT}
                                                stroke="#eee"
                                                strokeWidth="1"
                                            />
                                        ))}
                                        {/* Vertical Grid Lines (Hours) */}
                                        {[...Array(25)].map((_, i) => (
                                            <line
                                                key={`v-line-${i}`}
                                                x1={i * HOUR_WIDTH}
                                                y1="0"
                                                x2={i * HOUR_WIDTH}
                                                y2={SVG_HEIGHT}
                                                stroke={i % 12 === 0 ? '#aaa' : '#ccc'}
                                                strokeWidth="1"
                                            />
                                        ))}

                                        {/* Log Activity Lines and Transitions */}
                                        {data.segments.map((segment, index, arr) => (
                                            <React.Fragment key={index}>
                                                {/* Draw activity bar */}
                                                <rect
                                                    x={segment.startHour * HOUR_WIDTH}
                                                    y={dutyStatusMap[segment.status] * ROW_HEIGHT}
                                                    width={(segment.endHour - segment.startHour) * HOUR_WIDTH}
                                                    height={ROW_HEIGHT}
                                                    fill="black"
                                                />
                                                {/* Draw vertical transition line at the start of the segment (if not the very beginning of the day) */}
                                                {segment.startHour > 0 && (
                                                    <line
                                                        x1={segment.startHour * HOUR_WIDTH}
                                                        y1={0}
                                                        x2={segment.startHour * HOUR_WIDTH}
                                                        y2={SVG_HEIGHT}
                                                        stroke="black"
                                                        strokeWidth="2"
                                                    />
                                                )}
                                                {/* Draw vertical transition line at the end of the segment (if it's a transition point to a different status) */}
                                                {index < arr.length - 1 && (
                                                    <line
                                                        x1={segment.endHour * HOUR_WIDTH}
                                                        y1={0}
                                                        x2={segment.endHour * HOUR_WIDTH}
                                                        y2={SVG_HEIGHT}
                                                        stroke="black"
                                                        strokeWidth="2"
                                                    />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </svg>
                                </Grid>
                            </Grid>
                            {/* Daily Summary Table */}
                            <DailySummaryTable date={format(new Date(date), 'PPP')} summaryData={data.summary} />
                        </Paper>
                    ))}
                </Paper>
            </Box>
        </ThemeProvider>
    );
};
export default DailyLogVisualizer;