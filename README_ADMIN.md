# Admin Features Documentation

## Overview
The system now supports an Admin role with a dedicated dashboard to manage users and transactions.

## Setup
1. **Create an Admin User**:
   - Currently, users register as "user" by default.
   - To make a user an admin, you must manually update the database.
   - Connect to MongoDB and run:
     ```javascript
     db.users.updateOne({ username: "your_admin_username" }, { $set: { role: "admin" } })
     ```

## Features

### 1. Admin Dashboard (`/admin`)
- Lists all registered users.
- Shows username, role, and linked wallet address.
- Allows deleting users (except other admins).

### 2. User Details (`/admin/users/:id`)
- View detailed user information.
- View user's portfolio summary (raw JSON).
- View user's transaction history.
- **Manual Transaction Entry**: Admins can manually create transactions for users (e.g., to correct balances or record offline trades).

## API Endpoints
- `GET /api/admin/users`: List all users.
- `GET /api/admin/users/:id`: Get user details and transactions.
- `DELETE /api/admin/users/:id`: Delete a user.
- `POST /api/admin/users/:id/transactions`: Create a transaction.

## Security
- All admin routes are protected by JWT authentication.
- Middleware checks `req.user.role === 'admin'`.
- Frontend routes are protected by `AdminRoute` logic in `App.jsx`.
