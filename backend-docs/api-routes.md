# Crunch Fitness Club — Backend API Routes

> **Stack suggestion:** Node.js + Express/Fastify · PostgreSQL · JWT Auth · WebSockets (chat)
> **Base URL:** `/api/v1`
> **Auth header:** `Authorization: Bearer <access_token>`

---

## Auth Middleware Roles

| Tag | Meaning |
|-----|---------|
| 🔓 Public | No auth required |
| 🔐 Auth | Any logged-in user |
| 👑 Admin | `role === 'admin'` |
| 🏋️ Trainer | `role === 'trainer'` (scoped to their own data) |
| 👤 Client | `role === 'client'` (scoped to their own data) |
| 🏋️👤 Trainer or Client | Either role, scoped to the same conversation/record |

---

## 1. Authentication

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | 🔓 | Email + password → returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | 🔓 | `{ refreshToken }` → returns new `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | 🔐 | Revokes refresh token |
| GET  | `/auth/me` | 🔐 | Returns current user profile + role metadata |
| PUT  | `/auth/change-password` | 🔐 | `{ currentPassword, newPassword }` |

### POST `/auth/login` — Request Body
```json
{
  "email": "trainer@gym.com",
  "password": "secret123"
}
```
### POST `/auth/login` — Response
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "trainer@gym.com",
    "role": "trainer",
    "name": "John Smith",
    "trainerId": "uuid"   // present if role = trainer
  }
}
```

---

## 2. Admin — Trainer Accounts

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/admin/trainer-accounts` | 👑 | List all trainer user accounts |
| POST   | `/admin/trainer-accounts` | 👑 | Create trainer login + trainers row |
| DELETE | `/admin/trainer-accounts/:userId` | 👑 | Delete user + cascade all trainer data |

### POST `/admin/trainer-accounts` — Request Body
```json
{
  "name": "John Smith",
  "email": "john@gym.com",
  "password": "initialPass123",
  "trainerId": "optional-existing-trainer-uuid"
}
```

---

## 3. Blog Posts

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/posts` | 🔓 | List published posts. Query: `?category=&tag=&limit=&offset=` |
| GET    | `/posts/:slug` | 🔓 | Single post by slug (must be published) |
| GET    | `/admin/posts` | 👑 | List all posts (published + drafts) |
| POST   | `/admin/posts` | 👑 | Create post |
| PUT    | `/admin/posts/:id` | 👑 | Update post |
| DELETE | `/admin/posts/:id` | 👑 | Delete post |
| POST   | `/admin/posts/:id/cover` | 👑 | Upload cover image → returns `{ url }` |

### POST `/admin/posts` — Request Body
```json
{
  "title": "5 Tips for Fat Loss",
  "slug": "5-tips-for-fat-loss",
  "excerpt": "Short description...",
  "content": "Full markdown content...",
  "coverImage": "https://cdn.example.com/img.jpg",
  "category": "Fitness Tips",
  "author": "Crunch Fitness Club",
  "tags": ["fat loss", "nutrition"],
  "published": false
}
```

---

## 4. Team Members

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/team` | 🔓 | List visible team members ordered by `display_order` |
| GET    | `/admin/team` | 👑 | List all (including hidden) |
| POST   | `/admin/team` | 👑 | Add team member |
| PUT    | `/admin/team/:id` | 👑 | Update team member |
| DELETE | `/admin/team/:id` | 👑 | Delete team member |
| POST   | `/admin/team/:id/image` | 👑 | Upload photo → returns `{ url }` |

### POST `/admin/team` — Request Body
```json
{
  "name": "Sara Khan",
  "role": "Head Trainer",
  "specialization": "Strength & Conditioning",
  "experience": "8 years",
  "bio": "Sara has...",
  "image": "https://cdn.example.com/sara.jpg",
  "instagram": "@sarakhan_fit",
  "isOwner": false,
  "objectPosition": "center 30%",
  "displayOrder": 2,
  "visible": true
}
```

---

## 5. Offers & Promotions

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/offers` | 🔓 | List all active offers. Query: `?active=true` |
| GET    | `/admin/offers` | 👑 | List all offers |
| POST   | `/admin/offers` | 👑 | Create offer |
| PUT    | `/admin/offers/:id` | 👑 | Update offer |
| DELETE | `/admin/offers/:id` | 👑 | Delete offer |

### POST `/admin/offers` — Request Body
```json
{
  "title": "New Year Special",
  "description": "Get 3 months for the price of 2.",
  "badge": "🔥 LIMITED TIME",
  "color": "green",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "active": true
}
```

---

## 6. Membership Plans

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/plans` | 🔓 | List all plans ordered by `display_order` |
| GET    | `/admin/plans` | 👑 | Same but with internal IDs for editing |
| POST   | `/admin/plans` | 👑 | Create plan |
| PUT    | `/admin/plans/:id` | 👑 | Update plan |
| DELETE | `/admin/plans/:id` | 👑 | Delete plan |

### POST `/admin/plans` — Request Body
```json
{
  "displayOrder": 3,
  "duration": "3 Months",
  "price": "₹7,500",
  "originalPrice": "₹9,000",
  "description": "Best for consistent training",
  "features": ["Full gym access", "Locker", "Guest pass x2"],
  "idealFor": "Intermediate trainees",
  "savings": "₹1,500",
  "badge": "Most Popular",
  "isPopular": true,
  "gradient": "from-yellow-400 to-orange-500",
  "iconName": "Crown",
  "ctaText": "Transform Now"
}
```

---

## 7. Enquiries (Contact Form / Leads)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST   | `/enquiries` | 🔓 | Submit contact form |
| GET    | `/admin/enquiries` | 👑 | List enquiries. Query: `?status=new&read=false&limit=&offset=` |
| PUT    | `/admin/enquiries/:id` | 👑 | Update status / mark as read |
| DELETE | `/admin/enquiries/:id` | 👑 | Delete enquiry |

### POST `/enquiries` — Request Body
```json
{
  "name": "Ravi Sharma",
  "email": "ravi@email.com",
  "phone": "+91-9876543210",
  "plan": "3 Months",
  "message": "I want to join and lose weight..."
}
```

### PUT `/admin/enquiries/:id` — Request Body
```json
{
  "status": "contacted",
  "read": true
}
```

---

## 8. Duty Roster

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/admin/duties` | 👑 | List duties. Query: `?weekStart=2026-03-09` |
| POST   | `/admin/duties` | 👑 | Assign duty |
| PUT    | `/admin/duties/:id` | 👑 | Update duty |
| DELETE | `/admin/duties/:id` | 👑 | Delete duty |
| GET    | `/trainer/duties` | 🏋️ | Own duties. Query: `?weekStart=2026-03-09` |

### POST `/admin/duties` — Request Body
```json
{
  "trainerId": "uuid",
  "area": "Cardio Zone",
  "days": ["Monday", "Wednesday", "Friday"],
  "shift": "Morning (6am – 2pm)",
  "weekStart": "2026-03-09"
}
```

---

## 9. Class Sessions (Group Fitness)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/class-sessions` | 🏋️ | Own sessions. Query: `?date=2026-03-13` |
| GET    | `/admin/class-sessions` | 👑 | All sessions. Query: `?trainerId=&date=` |
| POST   | `/trainer/class-sessions` | 🏋️ | Create class session (auto-generates PIN) |
| PUT    | `/trainer/class-sessions/:id` | 🏋️ | Update session |
| DELETE | `/trainer/class-sessions/:id` | 🏋️ | Delete session |
| GET    | `/trainer/class-sessions/:id/attendance` | 🏋️ | Attendance list for a session |

### POST `/trainer/class-sessions` — Request Body
```json
{
  "title": "CrossFit 101",
  "area": "CrossFit",
  "date": "2026-03-14",
  "startTime": "06:00",
  "duration": 60,
  "capacity": 15
}
```
> Server generates `pin`, `pinValidFrom`, `pinValidTo` automatically.

---

## 10. Check-In (Public PIN-based)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST   | `/check-in` | 🔓 | Validate PIN and record attendance |

### POST `/check-in` — Request Body
```json
{
  "pin": "482910",
  "memberName": "Ankit Verma",
  "memberPhone": "+91-9000000001"
}
```

### POST `/check-in` — Response
```json
{
  "success": true,
  "session": {
    "title": "CrossFit 101",
    "trainerName": "John Smith",
    "startTime": "06:00"
  }
}
```

---

## 11. Trainer — Clients

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/clients` | 🏋️ | Own client list. Query: `?search=` |
| GET    | `/trainer/clients/:clientId` | 🏋️ | Single client detail |
| POST   | `/trainer/clients` | 🏋️ | Add client (without login) |
| PUT    | `/trainer/clients/:clientId` | 🏋️ | Update client info |
| DELETE | `/trainer/clients/:clientId` | 🏋️ | Delete client + all their data |
| POST   | `/trainer/clients/:clientId/grant-access` | 🏋️ | Create login for existing client |

### POST `/trainer/clients` — Request Body
```json
{
  "name": "Priya Mehta",
  "email": "priya@email.com",
  "phone": "+91-9123456789",
  "goal": "Fat Loss"
}
```

### POST `/trainer/clients/:clientId/grant-access` — Request Body
```json
{
  "email": "priya@email.com",
  "password": "initialPassword123"
}
```
> Creates a `users` row with `role = 'client'`, links `clients.user_id`.

---

## 12. PT Sessions (1-on-1 Training Sessions)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/sessions` | 🏋️ | All trainer sessions. Query: `?clientId=&status=&date=` |
| GET    | `/trainer/sessions/:id` | 🏋️ | Single session |
| POST   | `/trainer/sessions` | 🏋️ | Schedule session |
| PUT    | `/trainer/sessions/:id` | 🏋️ | Update status / notes |
| DELETE | `/trainer/sessions/:id` | 🏋️ | Delete session |
| GET    | `/client/sessions` | 👤 | Client's own sessions |

### POST `/trainer/sessions` — Request Body
```json
{
  "clientId": "uuid",
  "date": "2026-03-15",
  "time": "07:00",
  "duration": 60,
  "notes": "Focus on upper body"
}
```

---

## 13. Workout Plans

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/workout-plans` | 🏋️ | All trainer's plans |
| GET    | `/trainer/workout-plans/:id` | 🏋️ | Plan with exercises + assigned clients |
| POST   | `/trainer/workout-plans` | 🏋️ | Create plan |
| PUT    | `/trainer/workout-plans/:id` | 🏋️ | Update plan name/description/exercises |
| DELETE | `/trainer/workout-plans/:id` | 🏋️ | Delete plan |
| POST   | `/trainer/workout-plans/:id/assign` | 🏋️ | Assign to client(s) |
| DELETE | `/trainer/workout-plans/:id/assign/:clientId` | 🏋️ | Unassign from client |
| GET    | `/client/workout-plan` | 👤 | Client's assigned workout plan |

### POST `/trainer/workout-plans` — Request Body
```json
{
  "name": "Beginner Fat Loss Program",
  "description": "3-day full body split for beginners",
  "exercises": [
    { "name": "Squat",       "sets": 3, "reps": "12",   "notes": "Bodyweight",   "displayOrder": 1 },
    { "name": "Push-up",     "sets": 3, "reps": "10",   "notes": "",             "displayOrder": 2 },
    { "name": "Plank",       "sets": 3, "reps": "30s",  "notes": "Core tight",   "displayOrder": 3 }
  ],
  "assignedClientIds": ["uuid1", "uuid2"]
}
```

---

## 14. Progress Logs

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/clients/:clientId/progress` | 🏋️ | Client's logs ordered by date DESC |
| POST   | `/trainer/clients/:clientId/progress` | 🏋️ | Add log for a client |
| DELETE | `/trainer/clients/:clientId/progress/:logId` | 🏋️ | Delete a log entry |
| GET    | `/client/progress` | 👤 | Own logs |
| POST   | `/client/progress` | 👤 | Add own log entry |

### POST `/client/progress` — Request Body
```json
{
  "date": "2026-03-13",
  "notes": "Feeling strong today",
  "weight": 74.5,
  "bodyFat": 18.2,
  "waist": 83,
  "chest": 96,
  "arms": 36,
  "thigh": 56
}
```

---

## 15. Trainer Availability

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/availability` | 🏋️ | Own availability slots |
| POST   | `/trainer/availability` | 🏋️ | Add/replace a day slot |
| DELETE | `/trainer/availability/:id` | 🏋️ | Remove a slot |
| GET    | `/client/trainer-availability` | 👤 | See their trainer's availability |

### POST `/trainer/availability` — Request Body
```json
{
  "day": "Monday",
  "startTime": "06:00",
  "endTime": "10:00"
}
```

---

## 16. Session Requests (Booking Flow)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/trainer/session-requests` | 🏋️ | All requests. Query: `?status=pending` |
| PUT    | `/trainer/session-requests/:id` | 🏋️ | Confirm → auto-creates PT session. Reject → marks status. |
| GET    | `/client/session-requests` | 👤 | Own requests + status |
| POST   | `/client/session-requests` | 👤 | Submit a booking request |

### POST `/client/session-requests` — Request Body
```json
{
  "requestedDate": "2026-03-17",
  "requestedTime": "07:30",
  "duration": 60,
  "notes": "Prefer upper body day"
}
```

### PUT `/trainer/session-requests/:id` — Request Body
```json
{
  "status": "confirmed"
}
```
> When `status` is set to `confirmed`, the server **automatically creates a `pt_sessions` row** with the requested date/time and returns the new session.

---

## 17. Messages (Trainer ↔ Client Chat)

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/conversations` | 🏋️👤 | List conversations for current user |
| GET    | `/conversations/:conversationId/messages` | 🏋️👤 | Paginated message history. Query: `?limit=50&before=<messageId>` |
| POST   | `/conversations/:conversationId/messages` | 🏋️👤 | Send a message |
| WS     | `/ws/conversations/:conversationId` | 🏋️👤 | Real-time WebSocket channel for live messages |

> **Conversation ID resolution:** The server derives the `conversationId` from the current user's `trainerId` + `clientId` pair. A client hits `/conversations` and gets back their one conversation; a trainer gets a list of one per client.

### POST `/conversations/:conversationId/messages` — Request Body
```json
{
  "text": "Good morning! Ready for today's session?"
}
```

### WebSocket message event (server → client)
```json
{
  "event": "new_message",
  "data": {
    "id": "uuid",
    "senderId": "uuid",
    "senderName": "John Smith",
    "text": "Good morning! Ready for today's session?",
    "createdAt": "2026-03-13T06:00:00Z"
  }
}
```

---

## 18. File Uploads

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST   | `/uploads/image` | 👑 🏋️ | Upload image → returns `{ url }`. Replaces Firebase Storage. |

> Use `multipart/form-data`. On the server, pipe to **S3**, **Cloudinary**, or local `/public/uploads/`.

---

## Standard Response Envelope

All API responses follow this shape:

```json
// Success
{
  "success": true,
  "data": { ... }          // or array
}

// Paginated list
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 120,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",         // machine-readable
    "message": "Post not found"  // human-readable
  }
}
```

---

## HTTP Status Codes Used

| Code | When |
|------|------|
| 200  | Successful GET / PUT |
| 201  | Successful POST (resource created) |
| 204  | Successful DELETE (no body) |
| 400  | Validation error |
| 401  | Missing / invalid token |
| 403  | Authenticated but wrong role or not owner |
| 404  | Resource not found |
| 409  | Conflict (duplicate email, duplicate check-in) |
| 500  | Server error |

---

## Suggested Folder Structure (Express)

```backend/
│
├── app/
│
│   ├── core/
│   │
│   ├── config/
│   │
│   ├── database/
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   │
│   │   ├── users/
│   │   │
│   │   ├── trainers/
│   │   │
│   │   ├── clients/
│   │   │
│   │   ├── posts/
│   │   │
│   │   ├── team/
│   │   │
│   │   ├── offers/
│   │   │
│   │   ├── plans/
│   │   │
│   │   ├── enquiries/
│   │   │
│   │   ├── duties/
│   │   │
│   │   ├── class_sessions/
│   │   │
│   │   ├── checkins/
│   │   │
│   │   ├── pt_sessions/
│   │   │
│   │   ├── workout_plans/
│   │   │
│   │   ├── progress_logs/
│   │   │
│   │   ├── availability/
│   │   │
│   │   ├── session_requests/
│   │   │
│   │   └── messaging/
│   │
│   ├── repositories/
│   │
│   ├── services/
│   │
│   ├── websocket/
│   │
│   ├── storage/
│   │
│   ├── utils/
│   │
│   └── middleware/
│
│
├── infrastructure/
│   │
│   ├── docker/
│   │
│   ├── scripts/
│   │
│   └── configs/
│
│
├── deployment/
│   │
│   ├── docker/
│   │
│   ├── kubernetes/
│   │
│   └── compose/
│
│
├── tests/
│
│
├── docs/
│
│
├── scripts/
│
│
├── .github/
│   │
│   └── workflows/
│
│
├── environment/
│
│
└── build/
```

---

## Environment Variables Needed

```env
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/crunch_fitness

# JWT
JWT_SECRET=your_super_secret_key
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# File Storage (pick one)
S3_BUCKET=crunch-fitness-assets
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# OR
CLOUDINARY_URL=cloudinary://...

# CORS
ALLOWED_ORIGINS=https://crunchfitness.com,http://localhost:5173
```
