# Event Management System

Full stack event management app with React, Node.js, Express, MongoDB, JWT authentication, role-based access, event CRUD, registrations, and seat-limit protection.

## Backend Structure

- `src/routes` maps API endpoints to middleware and controller actions.
- `src/controllers` contains request handlers and business logic.
- `src/models` contains MongoDB/Mongoose schemas for `User`, `Event`, and `Registration`.
- `src/middleware` contains authentication, role authorization, validation, and error handling.
- `src/config` contains MongoDB and environment setup.

## Run Locally

1. Install backend dependencies:

   ```bash
   npm install
   ```

2. Install frontend dependencies:

   ```bash
   npm install --prefix client
   ```

3. Create environment values:

   ```bash
   copy .env.example .env
   ```

   Update `JWT_SECRET` before using real accounts.

4. Start MongoDB locally, then start the API:

   ```bash
   npm run dev
   ```

5. In a second terminal, start React:

   ```bash
   npm run client
   ```

The API runs on `http://localhost:3000` and the React app runs on `http://localhost:5173`.

## Roles

Signup accepts `role` as `user` or `admin`.

Admins can create, update, delete, and view all registrations. Users can view events and register for open seats.

## REST API

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Events

- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events` admin only
- `PUT /api/events/:id` admin only
- `DELETE /api/events/:id` admin only

### Registrations

- `GET /api/registrations` admin only
- `GET /api/registrations/me`
- `POST /api/registrations/:eventId`
- `DELETE /api/registrations/:eventId`

## Seat Limit Behavior

Registration uses an atomic MongoDB update to increment `registeredSeats` only when it is still lower than `seatLimit`. A unique registration index prevents the same user from registering for the same event twice, and the API rolls back the seat increment if a duplicate registration is attempted.
