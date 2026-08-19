# Frontend Setup

This is the React + Vite frontend for ResearchTube.

## Running with Docker (Recommended)

1. Ensure Docker Desktop is running.
2. Build and start the container:
   ``bash
   docker compose up --build
   ``
3. The frontend will be available at [http://localhost:5173](http://localhost:5173).

*(Note: Any changes you make to the code will automatically hot-reload in the browser thanks to the Docker volume mapping!)*

## Running locally without Docker (NPM)

1. Make sure Node.js (v18+) is installed.
2. Install dependencies:
   ``bash
   npm install
   ``
3. Start the development server:
   ``bash
   npm run dev
   ``
4. The frontend will be available at [http://localhost:5173](http://localhost:5173).
