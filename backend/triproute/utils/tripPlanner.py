import requests
import json
from datetime import timedelta
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

# --- Configuration Constants ---
# Open Source Routing Machine (OSRM) Public Demo Server
# This is free for light use. For a production app, you would
# need to host your own OSRM server or use a paid service.
OSRM_API_URL = "http://router.project-osrm.org/route/v1/driving/"

# Conversion factors
MILES_TO_METERS = 1609.34
HOURS_IN_SECONDS = 3600

# Driver-specific rules
MAX_CYCLE_HOURS = 70
MAX_DRIVING_HOURS_PER_DAY = 11
MAX_ON_DUTY_HOURS_PER_DAY = 14
DAILY_REST_HOURS = 10
REFUELING_MILEAGE_INTERVAL = 1000  # miles
REFUELING_STOP_DURATION_HOURS = 0.5  # 30-minute stop

# Initialize geolocator
geolocator = Nominatim(user_agent="route_planner_app")

def get_location_name(coords):
    """
    Performs a reverse geocode lookup to find the name of a city/town.
    Includes retry logic with exponential backoff and a timeout.
    """
    for i in range(3):  # Retry up to 3 times
        try:
            location = geolocator.reverse(coords, timeout=10)
            if location:
                # Prioritize city, town, or village name
                address = location.raw.get('address', {})
                city = address.get('city') or address.get('town') or address.get('village')
                if city:
                    return f"near {city}"
            return f"at coordinates {coords[0]:.2f}, {coords[1]:.2f}"
        except GeocoderTimedOut:
            print(f"Geocode request timed out. Retrying in {2**i} seconds...")
            time.sleep(2**i)
        except (GeocoderUnavailable, Exception) as e:
            print(f"Geocode request failed: {e}")
            break
    return f"at coordinates {coords[0]:.2f}, {coords[1]:.2f}"

def plan_trip(current_location: str, origin: str, destination: str, current_cycle_hours: list):
    """
    Plans a multi-day trip for a driver, considering duty cycle limits,
    and adds stops for refueling, pickup, and drop-off. This version uses a
    rolling 8-day cycle calculation for a three-point trip.

    Args:
        current_location (str): The driver's starting point (e.g., "Gulele, Addis Ababa").
        origin (str): The pickup location (e.g., "Addis Ababa, Ethiopia").
        destination (str): The final delivery location (e.g., "Mekele, Ethiopia").
        current_cycle_hours (list): A list of on-duty hours for the past 8 days.
                                    The oldest day's hours should be at index 0.

    Returns:
        dict: A dictionary containing the trip plan summary.
    """
    # --- Step 1: Geocode Locations ---
    try:
        current_geocode = geolocator.geocode(current_location, timeout=10)
        origin_geocode = geolocator.geocode(origin, timeout=10)
        dest_geocode = geolocator.geocode(destination, timeout=10)

        if not all([current_geocode, origin_geocode, dest_geocode]):
            return {"error": "One or more locations could not be geocoded. Please check the names."}
            
        current_coords = current_geocode.point
        origin_coords = origin_geocode.point
        dest_coords = dest_geocode.point 
    except (GeocoderTimedOut, GeocoderUnavailable, Exception) as e:
        return {"error": f"Geocoding failed for locations. Please check the names. Error: {e}"}
        
    # Helper function to get route data
    def get_route(start_coords, end_coords):
        start_str = f"{start_coords.longitude},{start_coords.latitude}"
        end_str = f"{end_coords.longitude},{end_coords.latitude}"
        api_endpoint = f"{OSRM_API_URL}{start_str};{end_str}?overview=full"
        
        response = requests.get(api_endpoint)
        response.raise_for_status()
        route_data = response.json()
        
        distance_meters = route_data['routes'][0]['distance']
        duration_seconds = route_data['routes'][0]['duration']
        
        return distance_meters / MILES_TO_METERS, duration_seconds / HOURS_IN_SECONDS

    try:
        # Get route for first leg (current location to origin)
        leg1_distance_miles, leg1_duration_hours = get_route(current_coords, origin_coords)
        
        # Get route for second leg (origin to destination)
        leg2_distance_miles, leg2_duration_hours = get_route(origin_coords, dest_coords)
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to get route from OSRM API. Error: {e}"}

    total_driving_distance_miles = leg1_distance_miles + leg2_distance_miles
    total_driving_duration_hours = leg1_duration_hours + leg2_duration_hours
    
    if total_driving_duration_hours > 0:
        average_speed_mph = total_driving_distance_miles / total_driving_duration_hours
    else:
        average_speed_mph = 0

    # --- Step 2: Simulate the Trip and Plan Stops ---
    trip_plan = []
    current_day = 1
    miles_since_last_refuel = 0
    
    # Create a copy to avoid modifying the original list
    cycle_hours = list(current_cycle_hours) 

    # --- Leg 1: Commute to Origin ---
    commute_driving_hours = leg1_duration_hours
    commute_miles_driven = 0
    while commute_driving_hours > 0:
        cycle_sum_last_7_days = sum(cycle_hours[1:])
        available_cycle_hours = MAX_CYCLE_HOURS - cycle_sum_last_7_days

        daily_driving_hours = min(commute_driving_hours, 
                                  MAX_DRIVING_HOURS_PER_DAY,
                                  available_cycle_hours)
        
        daily_miles_driven = daily_driving_hours * average_speed_mph
        
        # Add refueling stop logic here for the commute leg
        miles_since_last_refuel += daily_miles_driven
        if miles_since_last_refuel >= REFUELING_MILEAGE_INTERVAL:
            commute_fraction = (commute_miles_driven + daily_miles_driven) / leg1_distance_miles
            stop_coords = (
                current_coords.latitude + (origin_coords.latitude - current_coords.latitude) * commute_fraction,
                current_coords.longitude + (origin_coords.longitude - current_coords.longitude) * commute_fraction
            )
            stop_location_name = get_location_name(stop_coords)
            
            trip_plan.append({
                "day": current_day,
                "type": "Refueling Stop",
                "duration_hours": REFUELING_STOP_DURATION_HOURS,
                "description": f"Refueling stop {stop_location_name} after driving approximately {miles_since_last_refuel:.2f} miles.",
                "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
            })
            miles_since_last_refuel = 0
            commute_driving_hours -= REFUELING_STOP_DURATION_HOURS
            
        commute_fraction = commute_miles_driven / leg1_distance_miles if leg1_distance_miles else 0
        stop_coords = (
            current_coords.latitude + (origin_coords.latitude - current_coords.latitude) * commute_fraction,
            current_coords.longitude + (origin_coords.longitude - current_coords.longitude) * commute_fraction
        )
        trip_plan.append({
            "day": current_day,
            "type": "Driving (to Origin)",
            "duration_hours": daily_driving_hours,
            "distance_miles": daily_miles_driven,
            "description": f"Driving for {daily_driving_hours:.2f} hours to reach {origin}.",
            "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
        })
        
        commute_driving_hours -= daily_driving_hours
        commute_miles_driven += daily_miles_driven
        
        cycle_hours.pop(0)
        cycle_hours.append(daily_driving_hours)
        
        if commute_driving_hours > 0:
            commute_fraction = commute_miles_driven / leg1_distance_miles if leg1_distance_miles else 0
            stop_coords = (
                current_coords.latitude + (origin_coords.latitude - current_coords.latitude) * commute_fraction,
                current_coords.longitude + (origin_coords.longitude - current_coords.longitude) * commute_fraction
            )
            stop_location_name = get_location_name(stop_coords)
            
            trip_plan.append({
                "day": current_day,
                "type": "Daily Rest",
                "duration_hours": DAILY_REST_HOURS,
                "description": f"Mandatory 10-hour daily rest {stop_location_name}.",
                "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
            })
            current_day += 1

    # --- Pickup Stop ---
    trip_plan.append({
        "day": current_day,
        "type": "Pickup Stop",
        "duration_hours": 1,
        "description": f"One-hour stop for picking up the load at {origin}.",
        "coordinates": [float(f"{origin_coords.latitude:.4f}"), float(f"{origin_coords.longitude:.4f}")]
    })
    
    # Update cycle hours with pickup time
    cycle_hours.pop(0)
    cycle_hours.append(1)

    # --- Leg 2: Commute to Destination ---
    trip_driving_hours = leg2_duration_hours
    trip_miles_driven = 0
    while trip_driving_hours > 0:
        cycle_sum_last_7_days = sum(cycle_hours[1:])
        available_cycle_hours = MAX_CYCLE_HOURS - cycle_sum_last_7_days

        daily_driving_hours = min(trip_driving_hours, 
                                  MAX_DRIVING_HOURS_PER_DAY,
                                  available_cycle_hours)
        
        daily_miles_driven = daily_driving_hours * average_speed_mph
        
        miles_since_last_refuel += daily_miles_driven
        if miles_since_last_refuel >= REFUELING_MILEAGE_INTERVAL:
            trip_fraction = (trip_miles_driven + daily_miles_driven) / leg2_distance_miles if leg2_distance_miles else 0
            stop_coords = (
                origin_coords.latitude + (dest_coords.latitude - origin_coords.latitude) * trip_fraction,
                origin_coords.longitude + (dest_coords.longitude - origin_coords.longitude) * trip_fraction
            )
            stop_location_name = get_location_name(stop_coords)
            
            trip_plan.append({
                "day": current_day,
                "type": "Refueling Stop",
                "duration_hours": REFUELING_STOP_DURATION_HOURS,
                "description": f"Refueling stop {stop_location_name} after driving approximately {miles_since_last_refuel:.2f} miles.",
                "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
            })
            miles_since_last_refuel = 0
            trip_driving_hours -= REFUELING_STOP_DURATION_HOURS
            
        trip_fraction = trip_miles_driven / leg2_distance_miles if leg2_distance_miles else 0
        stop_coords = (
            origin_coords.latitude + (dest_coords.latitude - origin_coords.latitude) * trip_fraction,
            origin_coords.longitude + (dest_coords.longitude - origin_coords.longitude) * trip_fraction
        )
        trip_plan.append({
            "day": current_day,
            "type": "Driving (to Destination)",
            "duration_hours": daily_driving_hours,
            "distance_miles": daily_miles_driven,
            "description": f"Driving for {daily_driving_hours:.2f} hours to the final destination.",
            "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
        })
        
        trip_driving_hours -= daily_driving_hours
        trip_miles_driven += daily_miles_driven
        
        cycle_hours.pop(0)
        cycle_hours.append(daily_driving_hours)
        
        if trip_driving_hours > 0:
            trip_fraction = trip_miles_driven / leg2_distance_miles if leg2_distance_miles else 0
            stop_coords = (
                origin_coords.latitude + (dest_coords.latitude - origin_coords.latitude) * trip_fraction,
                origin_coords.longitude + (dest_coords.longitude - origin_coords.longitude) * trip_fraction
            )
            stop_location_name = get_location_name(stop_coords)
            
            trip_plan.append({
                "day": current_day,
                "type": "Daily Rest",
                "duration_hours": DAILY_REST_HOURS,
                "description": f"Mandatory 10-hour daily rest {stop_location_name}.",
                "coordinates": [float(f"{stop_coords[0]:.4f}"), float(f"{stop_coords[1]:.4f}")]
            })
            current_day += 1

    # --- Drop-off Stop ---
    trip_plan.append({
        "day": current_day,
        "type": "Drop-off Stop",
        "duration_hours": 1,
        "description": f"One-hour stop for dropping off the load at {destination}.",
        "coordinates": [float(f"{dest_coords.latitude:.4f}"), float(f"{dest_coords.longitude:.4f}")]
    })

    total_planned_duration_hours = sum(stop['duration_hours'] for stop in trip_plan)

    summary = {
        "current_location": current_location,
        "origin": origin,
        "destination": destination,
        "total_distance_miles": float(f"{total_driving_distance_miles:.2f}"),
        "total_duration_hours": float(f"{total_planned_duration_hours:.2f}"),
        "driverName": "John Doe",
        "truckId": "TRK-12345",
        "planned_stops": trip_plan
    }

    return summary