1. System Overview
Purpose

Build a web platform that allows fitness trainers to manage their personal training clients, sessions, workouts, and progress while allowing clients to interact only with their assigned trainer.

The platform follows a trainer-owned client model.

Core Principle
Trainer owns the data
Client interacts with trainer data
Admin manages platform only

Clients cannot manage trainer systems or access other trainers.

2. User Roles
2.1 Trainer

Trainer is the primary user of the platform.

Capabilities:

Manage clients

Schedule PT sessions

Set availability

Create workout plans

Track client progress

Communicate with clients

2.2 Client

Client is invited by a trainer.

Capabilities:

View sessions

View assigned workout plans

Track personal progress

Message trainer

Clients cannot modify trainer configurations.

2.3 Admin

Admin manages the platform.

Capabilities:

Manage trainer accounts

View platform analytics

Manage subscriptions

Manage support requests

Admin cannot read private trainer client data.

3. Data Ownership Model

Each client belongs to exactly one trainer.

Relationship:

Trainer → Many Clients
Client → One Trainer

Example:

Trainer A
  ├ Client 1
  ├ Client 2

Trainer B
  ├ Client 3

Client 1 cannot see Trainer B or their clients.

4. System Architecture
Frontend

Web application built with:

React / Next.js

Component based UI

Role based dashboards

Dashboards:

Trainer Dashboard
Client Dashboard
Admin Dashboard
Backend

Backend services:

Authentication

Firestore database

Cloud functions

Notification service

Example services:

Auth Service
Trainer Data Service
Session Scheduling Service
Messaging Service
Notification Service
Database

Primary database:

Firestore

Data grouped by trainer ownership.

5. Core Features
Feature 1 — Client Management
Description

Allows trainers to create and manage personal training clients.

Trainer Capabilities

Trainer can:

Add client

Edit client

Remove client

View client details

Assign workout plans

Track progress

Trainer Workflow
Trainer Dashboard
      ↓
Clients
      ↓
Add Client
      ↓
Enter details
      ↓
Save
Client Capabilities

Client can:

View trainer

View sessions

View workout plans

Track progress

Send messages

Client cannot create or edit trainer data.

Data Structure
trainerData/{trainerId}/clients/{clientId}

Example document:

{
 name: "Rahul Sharma",
 email: "rahul@email.com",
 phone: "9876543210",
 goal: "Fat Loss",
 trainerId: "trainer123",
 createdAt: timestamp
}
Feature 2 — PT Session Management
Description

Allows trainers to schedule personal training sessions with clients.

Trainer Capabilities

Trainer can:

Create session

Modify session

Cancel session

Mark session completed

View schedule

Trainer Workflow
Dashboard
   ↓
Sessions
   ↓
Add Session
   ↓
Select Client
   ↓
Select Date + Time
   ↓
Save
Client Capabilities

Client can:

View upcoming sessions

Receive reminders

Request reschedule

View session history

Session Status
scheduled
completed
cancelled
no-show
Data Structure
trainerData/{trainerId}/sessions/{sessionId}

Example:

{
 clientId: "client123",
 trainerId: "trainer123",
 date: "2026-03-15",
 time: "18:00",
 status: "scheduled"
}
Feature 3 — Trainer Availability
Description

Trainer sets available time slots for sessions.

Clients can book sessions based on these slots.

Trainer Workflow
Dashboard
   ↓
Availability
   ↓
Select Day
   ↓
Add Time Slots

Example:

Monday
 6:00 AM
 7:00 AM
 5:00 PM
Client Workflow
Book Session
   ↓
Select Trainer
   ↓
View Available Slots
   ↓
Choose Slot
   ↓
Confirm
Data Structure
trainerData/{trainerId}/availability/{day}

Example:

{
 slots: ["06:00","07:00","18:00"]
}
Feature 4 — Workout Plan Builder
Description

Trainer creates workout programs and assigns them to clients.

Trainer Capabilities

Trainer can:

Create workout plan

Edit workout plan

Assign to clients

Trainer Workflow
Dashboard
   ↓
Workout Plans
   ↓
Create Plan
   ↓
Add Exercises
Client Capabilities

Client can:

View assigned workouts

Mark workouts completed

View history

Data Structure
trainerData/{trainerId}/workoutPlans/{planId}

Example:

{
 name: "Fat Loss Program",
 exercises: [
  { name: "Squats", sets: 4, reps: 10 },
  { name: "Pushups", sets: 3, reps: 12 }
 ]
}
Feature 5 — Progress Tracking
Description

Track physical metrics over time.

Trainer Capabilities

Trainer can:

Add progress entries

Edit entries

View charts

Client Capabilities

Client can:

Update personal metrics

View progress charts

Metrics Example
weight
bodyFat
waist
chest
arms
thigh
Data Structure
trainerData/{trainerId}/clients/{clientId}/progressLogs/{logId}

Example:

{
 weight: 82,
 bodyFat: 20,
 waist: 88,
 date: timestamp
}
Feature 6 — Messaging
Description

In-app messaging between trainer and client.

Capabilities

Trainer and client can:

send messages

receive messages

view conversation history

Data Structure
messages/{conversationId}/messages/{messageId}

Example:

{
 senderId: "client123",
 text: "Can I replace squats?",
 timestamp: timestamp
}
Feature 7 — Notifications

Purpose: send reminders and updates.

Examples:

Session reminder
New workout assigned
Message received

Delivery methods:

Push notification
Email
In-app notification
6. Security & Permissions
Trainer Access

Trainer can access:

trainerData/{trainerId}

Rule:

allow read, write if auth.uid == trainerId
Client Access

Client can only access:

their own records

Example rule logic:

allow read if request.auth.uid == clientId
Admin Access

Admin can access:

trainer profiles
platform analytics
subscriptions

Admin cannot access:

trainerData/*
7. Dashboards
Trainer Dashboard

Shows:

Clients
Upcoming Sessions
Workout Plans
Availability
Messages
Progress
Client Dashboard

Shows:

My Trainer
Upcoming Sessions
Workout Plan
Progress Tracker
Messages
Admin Dashboard

Shows:

Total Trainers
Total Clients
Revenue
Active Sessions
8. Full Database Layout
users
   └ userId

trainerData
   └ trainerId
        ├ clients
        │   └ clientId
        │        └ progressLogs
        ├ sessions
        ├ availability
        ├ workoutPlans
        └ dietPlans

messages
notifications
subscriptions
9. Scalability Considerations

System must support:

1000+ trainers
10000+ clients

Key design rules:

isolate trainer data

avoid cross-trainer queries

keep collections shallow

use indexed queries