from rest_framework.views import APIView
from rest_framework.response import Response

from .utils import plan_trip 

class PlanTripView(APIView):
    def post(self, request):
        
        current_location = request.data.get('current_location')
        origin = request.data.get('origin')
        destination = request.data.get('destination')
        current_cycle_hours = request.data.get('current_cycle_hours', [0]*8)

        result = plan_trip(current_location, origin, destination, current_cycle_hours)
        return Response(result)