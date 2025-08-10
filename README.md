# Trip Route Application

This project is a full-stack application that allows users to input trip details and receive route instructions and ELD logs. It is built using Django for the backend and React for the frontend, and it is containerized using Docker.

## Project Structure

```
trip-route-app
├── backend               # Django backend application
│   ├── manage.py        # Command-line utility for managing the Django project
│   ├── triproute        # Django project settings and configuration
│   ├── trips            # Django app for handling trip details
│   ├── requirements.txt  # Python dependencies for the backend
│   └── Dockerfile       # Dockerfile for building the backend image
├── frontend              # React frontend application
│   ├── public           # Public assets for the React app
│   ├── src              # Source code for the React app
│   ├── package.json     # npm configuration for the frontend
│   └── Dockerfile       # Dockerfile for building the frontend image
├── docker-compose.yml    # Docker Compose file for multi-container setup
└── README.md            # Project documentation
```

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd trip-route-app
   ```

2. Build and run the application using Docker Compose:
   ```
   docker-compose up --build
   ```

### Usage

- Access the frontend application at `http://localhost:3000`.
- Input trip details in the form provided.
- The application will process the details and display route instructions and ELD logs.

### Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

### License

This project is licensed under the MIT License.