# 🌐 ConnectSphere — Full-Stack Social Media Web Application

## ✨ Features

* 🔐 **Authentication:** User registration and login using JWT-based authentication and password hashing.
* 👤 **Profiles:** View user profiles and manage profile information.
* 🤝 **Follow requests:** Send follow requests and accept or reject incoming requests.
* 👥 **Social connections:** Browse registered users and view followers and following lists.
* 📝 **Posts:** Create posts and browse a shared feed.
* ❤️ **Engagement:** Like and comment on posts.
* 🔔 **Notifications:** Notifications for supported social interactions, including follow requests.
* 💬 **Messaging:** User-to-user messaging functionality.
* 📱 **Responsive interface:** Frontend built with HTML, CSS, and JavaScript.

> \\\\\\\*\\\\\\\*Note:\\\\\\\*\\\\\\\* Feature availability depends on the version of the backend and frontend currently deployed. This repository contains the development project, not a hosted production service.

## 🛠️ Technology Stack

|Layer|Technologies|
|-|-|
|Frontend|HTML5, CSS3, JavaScript|
|Backend|Node.js, Express.js|
|Database|PostgreSQL|
|Authentication|JWT, bcrypt|
|Security \& Middleware|Helmet, CORS, cookie-parser|
|Version Control|Git, GitHub|

## 📁 Project Structure

```text
ConnectSphere/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── postRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── messageRoutes.js
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── database/
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── profile.html
│   ├── create-post.html
│   ├── messages.html
│   └── notifications.html
├── messaging-backup/
├── notification-backup/
└── .gitignore
```

## ⚙️PostgreSQL

Create a PostgreSQL database named `connectsphere`:

```sql
CREATE DATABASE connectsphere;
```

**Database schema:** This application requires tables for users, follows, posts, likes, comments, messages, and notifications. Apply the schema or migrations provided with your project before starting the app. Creating the database alone does **not** create those tables.

## 🔌 API Overview

The backend organizes API routes by feature:

|Base route|Purpose|
|-|-|
|`/api/auth`|Registration and login|
|`/api/users`|Profiles, suggestions, and follow requests|
|`/api/posts`|Feed, posts, likes, and comments|
|`/api/notifications`|Notification retrieval and updates|
|`/api/messages`|Messaging|
|`/api/health`|Backend and database health check|

For the exact HTTP methods and request bodies, see the route files under `backend/routes/`.

## 🧪 Basic Testing Checklist

1. Register a new account and sign in.
2. Confirm that other registered accounts appear in user suggestions.
3. Send a follow request from one account to another.
4. Accept or reject the request from the recipient account.
5. Create a post and check whether it appears in the feed.
6. Test likes, comments, notifications, and messages.
7. Verify the server and database using `/api/health`.

