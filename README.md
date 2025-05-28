<a name="readme-top"></a>

<div align="center">
  <img src="https://res.cloudinary.com/dvtc6coe2/image/upload/v1748447526/UNI_logo2_gzkocx.png" alt="UNIverse Platform Logo" width="300">
  <h1><b>UNIverse Platform</b></h1>
  <p>A comprehensive application for university communities, fostering connection, collaboration, and resource sharing.</p>
</div>

<!-- TABLE OF CONTENTS -->

# 📗 Table of Contents

- [📖 About the Project](#about-project)
  - [🌟 Overview](#overview)
  - [🛠 Built With](#built-with)
    - [Tech Stack](#tech-stack)
    - [Key Features](#key-features)
  - [🚀 Live Demo ](#live-demo)
- [ How the Code Works (Backend)](#how-the-code-works)
  - [Project Structure](#project-structure)
  - [Core Modules & Functionalities](#core-modules--functionalities)
    - [Authentication Flow](#authentication-flow)
    - [User Profiles & ID Verification](#user-profiles--id-verification)
    - [Groups](#groups)
    - [Channels](#channels)
    - [Posts](#posts)
    - [Comments](#comments)
    - [Events](#events)
    - [Chat & Messaging](#chat--messaging)
    - [Reporting System](#reporting-system)
    - [File Uploads](#file-uploads)
- [💻 Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Environment Variables](#environment-variables)
  - [Install](#install)
  - [Usage](#usage)
  - [Run tests](#run-tests)
- [📄 API Endpoints Summary](#api-endpoints-summary)
- [👥 Authors](#authors)
- [🔭 Future Features](#future-features)
- [🤝 Contributing](#contributing)
- [⭐️ Show your support](#support)
- [🙏 Acknowledgements](#acknowledgements)
- [📝 License](#license)

<!-- PROJECT DESCRIPTION -->

# 📖 About the Project <a name="about-project"></a>

## 🌟 Overview <a name="overview"></a>

**UNIverse Platform** is a multifaceted web application built with the MERN (MongoDB, Express.js, React.js/NextJS, Node.js) stack, designed to serve as a central hub for university students, faculty, and administrators. It aims to enhance campus life by providing tools for communication, collaboration, event management, resource sharing, and community building.

The platform features robust user authentication with role-based access control, real-time chat and messaging powered by Socket.IO, a dynamic posting system for groups and university-wide channels, event creation and attendance tracking, and a comprehensive reporting system for content moderation. Cloudinary is leveraged for efficient media and file storage, including an innovative ID card verification system using OCR for automated role assignment.

To ensure a safe and supportive digital environment, the platform integrates AI-powered content moderation to automatically detect and flag inappropriate or harmful content. Additionally, it features a conversational AI chatbot to assist users with common questions, platform navigation, and feature usage—enhancing user experience and engagement.

## 🛠 Built With <a name="built-with"></a>

### Tech Stack <a name="tech-stack"></a>

<details>
  <summary><strong>Client-Side (Frontend - Assumed for a MERN App)</strong></summary>
  <ul>
    <li><a href="https://reactjs.org/">React.js</a> (with Hooks & Context API or a state manager like Redux/Zustand)</li>
    <li><a href="https://reactrouter.com/">React Router</a> (for navigation)</li>
    <li><a href="https://axios-http.com/">Axios</a> (for API requests)</li>
    <li><a href="https://socket.io/docs/v4/client-api/">Socket.IO Client</a> (for real-time communication)</li>
    <li>CSS Framework (e.g., <a href="https://tailwindcss.com/">Tailwind CSS</a>, <a href="https://mui.com/">Material-UI</a>, <a href="https://getbootstrap.com/">Bootstrap</a>)</li>
    <li>Date Management (e.g., <a href="https://date-fns.org/">date-fns</a> or <a href="https://momentjs.com/">Moment.js</a>)</li>
  </ul>
</details>

<details>
  <summary><strong>Server-Side (Backend)</strong></summary>
  <ul>
    <li><a href="https://nodejs.org/">Node.js</a> (runtime environment)</li>
    <li><a href="https://expressjs.com/">Express.js</a> (web application framework)</li>
    <li><a href="https://mongoosejs.com/">Mongoose</a> (MongoDB object modeling)</li>
    <li><a href="https://socket.io/">Socket.IO</a> (real-time engine)</li>
    <li><a href="https://www.npmjs.com/package/jsonwebtoken">JSON Web Token (JWT)</a> (for authentication)</li>
    <li><a href="https://www.npmjs.com/package/bcrypt">bcrypt</a> (for password hashing)</li>
    <li><a href="https://www.npmjs.com/package/multer">Multer</a> (for handling multipart/form-data, file uploads)</li>
    <li><a href="https://cloudinary.com/">Cloudinary SDK</a> (for cloud-based image and file storage, and OCR)</li>
    <li><a href="https://www.npmjs.com/package/nodemailer">Nodemailer</a> (for sending emails)</li>
    <li><a href="https://www.npmjs.com/package/express-validator">express-validator</a> (for request data validation)</li>
    <li><a href="https://www.npmjs.com/package/dotenv">dotenv</a> (for environment variable management)</li>
    <li><a href="https://www.npmjs.com/package/cors">cors</a> (for Cross-Origin Resource Sharing)</li>
    <li><a href="https://www.npmjs.com/package/helmet">helmet</a> (for securing Express apps with HTTP headers)</li>
    <li><a href="https://www.npmjs.com/package/morgan">morgan</a> (HTTP request logger)</li>
    <li><a href="https://www.npmjs.com/package/express-async-errors">express-async-errors</a> (for handling async errors in Express)</li>
  </ul>
</details>

<details>
<summary><strong>Database</strong></summary>
  <ul>
    <li><a href="https://www.mongodb.com/">MongoDB</a> (NoSQL database, often with MongoDB Atlas for cloud hosting)</li>
  </ul>
</details>

<details>
<summary><strong>Development Tools & Practices</strong></summary>
  <ul>
    <li>Git & GitHub (Version Control)</li>
    <li>VS Code (Code Editor)</li>
    <li>Postman / Insomnia (API Testing)</li>
    <li>Nodemon (for automatic server restarts during development)</li>
    <li>ESLint / Prettier (Code linting and formatting)</li>
    <li>RESTful API Design Principles</li>
    <li>MVC (Model-View-Controller) or similar architectural pattern for backend organization</li>
  </ul>
</details>

### Key Features <a name="key-features"></a>

-   **User Management:**
    -   Secure signup with email verification.
    -   Login with JWT-based authentication.
    -   Role-based access control (Student, Teacher, System Admin, University Admin).
    -   Automated role assignment via ID card OCR (Cloudinary).
    -   User profiles with image uploads.
-   **University & Channel Management:**
    -   System admins can create and manage universities.
    -   University admins can create and manage university-specific channels (e.g., announcements, departmental).
    -   Channel profile pictures.
-   **Group Functionality:**
    -   Users can create and join groups (public, private, university-specific).
    -   Group administration (admins, moderators).
    -   Join request system for private groups.
    -   Group profile and cover photo uploads.
-   **Content Creation & Interaction:**
    -   Users can create posts within groups or channels, with optional file attachments.
    -   Like/unlike posts and comments.
    -   Threaded commenting system on posts.
-   **AI Model Integration**
    -   Uploaded (image/text) content is filtered with AI
    -   Ensures user safety from online bullying and harassment 
-   **AI Chatbot**
    -   Users can ask the chatbot any question they want
    -   Users can easily access the chatbot from the landing page
-   **Event Management:**
    -   Users (with appropriate permissions) can create university events.
    *   Structured event location (physical address or online meeting URL).
    -   Event cover images, attendee registration, and external registration links.
    -   Associated real-time chat for each event.
-   **Real-time Communication:**
    -   One-on-one and group/event chats using Socket.IO.
    -   Real-time message delivery, typing indicators, and read receipts (basic).
    -   File sharing within chats.
-   **Moderation & Reporting:**
    -   Users can report posts, groups, comments, etc.
    -   Admin interface (conceptual) for reviewing and resolving reports.
    -   Automated actions based on report thresholds (e.g., user warnings/bans, content removal).
-   **File Storage:** Secure and efficient file/image storage using Cloudinary.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LIVE DEMO -->

## 🚀 Live Demo <a href="https://universeapp-ruby.vercel.app" name="live-demo"></a>

-   [Live Demo Link](https://universeapp-ruby.vercel.app)
-   [Frontend Repository Link](https://github.com/Berihun101/universe_frontend)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- HOW THE CODE WORKS -->

#  How the Code Works (Backend) <a name="how-the-code-works"></a>

The backend of UNIverse Platform is built using Node.js and Express.js, following a modular structure inspired by the MVC (Model-View-Controller) pattern. Mongoose is used as an ODM (Object Data Modeling) library to interact with the MongoDB database.

## Project Structure <a name="project-structure"></a>
```
/
├── config/ # Configuration files for Database, Cloudinary, Passport (if used)
├── controllers/ # Handles incoming requests, interacts with models, and sends responses
├── middleware/ # Custom middleware (e.g., authentication, error handling, validation)
├── models/ # Mongoose schemas and models defining the data structure
├── routes/ # API route definitions, mapping URLs to controller functions
├── utils/ # Utility/helper functions (e.g., email sending, file utilities)
├── socket.js # Socket.IO server setup and event handling
├── server.js # Main application entry point; sets up the Express app
├── .env # Environment variables (not committed to version control)
├── package.json # Project metadata and dependencies
└── ...
```


## Core Modules & Functionalities <a name="core-modules--functionalities"></a>

### Authentication (`authController.js`, `authMiddleware.js`)
-   **Signup:** Users register with name, email, password, and upload an ID card. Passwords are hashed using `bcrypt`. An email verification token is generated and sent via `nodemailer`.
-   **ID Card OCR:** The uploaded ID card is sent to Cloudinary for OCR. Text is extracted, and keywords ("student," "teacher") are used to *tentatively* assign a role. The user's `idCardUrl` is stored, and a `verified` flag indicates ID check status.
-   **Login:** Users log in with email and password. `bcrypt.compare` validates the password. Upon success, a JSON Web Token (JWT) is generated, containing `userId` and `role`.
-   **Protection:** The `protect` middleware verifies the JWT from the `Authorization: Bearer <token>` header for protected routes, attaching `req.user` to the request.
-   **Authorization:** The `authorize` middleware checks if `req.user.role` matches specified roles or if the user has specific permissions on a resource (e.g., is a channel admin).

### User Profiles & ID Verification (`userController.js`, `User.js`)
-   Users have profiles with fields like department, faculty, profile picture (Cloudinary URL), etc.
-   The `verified` field on the User model is set to `true` after successful ID card OCR and role assignment, or by manual admin verification. `accountStatus` tracks the overall state (e.g., `waitVerification`, `waitIdVerification`, `active`, `banned`).

### File Uploads (`Cloudinary`, `Multer`, `cloudinaryUploader.js`)
-   `Multer` middleware handles `multipart/form-data` requests. Files are typically stored in memory (`multer.memoryStorage()`).
-   A utility function (`uploadToCloudinary`) streams the file buffer to Cloudinary, which returns a secure URL and public ID.
-   Different folders on Cloudinary are used for profile pictures, ID cards, post attachments, event covers, etc.
-   Pre-delete Mongoose hooks are implemented in models to delete associated files from Cloudinary when a document (e.g., Post, Event, User) is deleted.

### Entity Management (General Pattern for Groups, Channels, Posts, Events, etc.)
-   **Models (`models/`):** Define the schema, validation, virtuals, indexes, and middleware (e.g., `pre('save')`, `pre('findOneAndDelete')`) for each entity.
-   **Controllers (`controllers/`):** Contain the business logic for CRUD operations, membership management, interactions (likes, attends), etc. They interact with models and handle request/response cycles.
-   **Routes (`routes/`):** Define API endpoints, apply middleware (authentication, authorization, validation, file uploads), and map requests to controller functions. `express-validator` is used for input validation.

### Groups (`Group.js`, `groupController.js`)
-   Users can create groups (creator becomes an admin).
-   Groups have admins (max 5) and moderators (max 10), who must be members.
-   Privacy settings (`public`, `private`, `university_only`, etc.) control visibility and join mechanisms.
-   Private groups use a `joinRequests` system, managed by group staff.
-   When a group is created, an associated `Chat` room is also created, and its ID is stored in `group.associatedChat`. Group members are automatically added as participants to this chat.
-   Joining/leaving a group also updates the participant list of the associated chat.

### Channels (`Channel.js`, `channelController.js`)
-   Created by System Admins or designated University Admins.
-   Associated with a specific `University`.
-   Have a `channelType` (e.g., announcement, departmental).
-   Users can join/leave channels (access might be restricted by `isPublic` and university affiliation).

### Posts (`Post.js`, `postController.js`)
-   Users can create posts within `Groups` or `Channels`.
-   Posts can include text content and multiple file attachments (stored on Cloudinary).
-   Features liking and will have a separate `Comment` system.
-   Pre-delete hooks clean up Cloudinary files and associated comments/reports.

### Comments (`Comment.js`, `commentController.js`)
-   Hierarchical: Comments can be top-level on a `Post` or replies to other `Comments` (using `parentCommentId`).
-   Feature liking and editing.
-   Pre-delete hooks ensure replies and reports are also cleaned up.

### Events (`Event.js`, `eventController.js`)
-   Can be created by authorized users (e.g., admins, teachers).
-   Associated with a `University`.
-   Detailed `location` object (for physical or online events) and `registrationLink`.
-   Manage attendees and have an optional `maxAttendees` limit.
-   An associated `Chat` room is created for each event, with organizers/attendees as participants.
-   Joining/leaving event attendance also updates the participant list of the event's chat.
-   Pre-delete hooks clean up the associated chat, Cloudinary cover image, and reports.

### Chat & Messaging (`Chat.js`, `Message.js`, `chatController.js`, `messageController.js`, `socket.js`)
-   **`Chat` Model:** Represents a conversation (one-on-one, group, or event). Stores participants and a link to the last message.
-   **`Message` Model:** Represents an individual message within a chat, including content, sender, optional file attachment, likes, reactions, and read receipts.
-   **Controllers:**
    -   `chatController`: Handles creating/finding chat rooms and fetching a user's chat list.
    -   `messageController`: Handles sending new messages (text/file), fetching messages for a chat, editing/deleting messages, and marking messages as read.
-   **Socket.IO (`socket.js`):**
    -   Handles real-time communication.
    -   Authenticates socket connections using JWT.
    -   Manages rooms based on `chatId`. Clients `joinChat` to receive updates for that specific chat.
    -   After HTTP requests (e.g., new message via POST), controllers use the `io` instance to `emit` events (`newMessage`, `messageUpdated`, `messageDeleted`, `chatParticipantsUpdated`, `typing`) to the relevant chat room.
    -   Clients listen for these events to update their UI in real-time.

### Reporting System (`Report.js`, `reportController.js`)
-   Users can report various content types (`Post`, `Group`, `Comment`, `Channel`, `User`).
-   Reports store `targetType`, `targetId`, `reason`, and `reportedBy`.
-   Admins can view and resolve reports, recording `actionTaken` and `adminNotes`.
-   An automated system (`handleReportThresholds`) in `reportController` checks unresolved report counts after a new report is created. Based on thresholds, it can:
    -   Warn/ban users (updating `User.accountStatus`).
    -   Remove reported content (posts/comments).
    -   Deactivate groups (updating `Group.status`).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## 💻 Getting Started <a name="getting-started"></a>

To get a local copy up and running, follow these steps.

### Prerequisites <a name="prerequisites"></a>

-   **Node.js:** Version 16.x or higher recommended. Download from [nodejs.org](https://nodejs.org/).
-   **npm** (Node Package Manager) or **yarn:** Comes with Node.js.
-   **MongoDB:**
    -   Install MongoDB Community Server locally ([MongoDB Installation Guide](https://www.mongodb.com/try/download/community)).
    -   OR use a cloud-hosted MongoDB service like [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
-   **Cloudinary Account:** Sign up at [cloudinary.com](https://cloudinary.com/). You will need your Cloud Name, API Key, and API Secret. Enable the OCR Add-on if you plan to use the ID card verification feature.
-   **Email Service (for `nodemailer`):**
    -   For development: A service like [Mailtrap.io](https://mailtrap.io/) (for testing emails in a fake inbox).
    -   For production: A transactional email service like SendGrid, Mailgun, AWS SES, etc.
-   **Git:** For version control.
-   **Code Editor:** VS Code is recommended.
-   **API Client:** Postman or Insomnia for testing API endpoints.

### Setup <a name="setup"></a>

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/getssh/UNIverse_Backend
    cd UNIverse_Backend
    ```

2.  **Create Environment File:**
    Duplicate the `.env.example` file (if you have one) or create a new file named `.env` in the root of the project.

### Environment Variables <a name="environment-variables"></a>

Populate your `.env` file with the following (replace placeholders with your actual values):

```env
NODE_ENV=development
PORT=5000

# MongoDB Connection URI
MONGO_URI=mongodb://localhost:27017/uniPlatformDB # Or your MongoDB Atlas URI

# JWT Configuration
JWT_SECRET=YOUR_VERY_STRONG_JWT_SECRET_KEY_HERE # Change this to a long, random string
JWT_EXPIRES_IN=1d # e.g., 1d, 7d, 1h
# JWT_COOKIE_EXPIRES_IN_DAYS=1 # If using cookies for JWT

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Nodemailer Configuration (Example using Mailtrap for development)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your_mailtrap_username
EMAIL_PASS=your_mailtrap_password
EMAIL_FROM='"UNIverse Platform" <noreply@universe.com>' # Sender display name and email

# Frontend URL (for links in emails, CORS)
CLIENT_URL=http://localhost:3000 # Your React frontend URL
```

### Install <a name="install"></a>

Install project dependencies:

```npm install```

OR if using yarn

yarn install

### Usage <a name="usage"></a>
1. Ensure MongoDB is running (if local) or accessible (if cloud).
2. Start the development server:

```npm run dev```

### Run tests <a name="run-tests"></a>

Use postman to test the endpoints and functionality

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### API Endpoints Summary <a name="api-endpoints-summary"></a>

A Postman collection or detailed API documentation (e.g., using Swagger/OpenAPI) would provide comprehensive details. Here's a high-level summary:

-   **Auth:**
    - POST /api/auth/register - User signup (with ID card & profile pic)
    - POST /api/auth/login - User login
    - GET /api/auth/verify-email/:token - Email verification
    - GET /api/auth/me - Get current logged-in user (Protected)

-   **Users:**
    - GET /api/users/:userId - Get user profile
    - PUT /api/users/profile - Update current user's profile (Protected)
-   **Universities:** (Admin protected for CUD)
    - POST /api/universities - Create university
    - GET /api/universities - Get all universities
    - GET /api/universities/:universityId - Get single university
    - PUT /api/universities/:universityId - Update university
    - DELETE /api/universities/:universityId - Delete university
-   **Channels:**
    - POST /api/channels - Create channel (Admin/Uni Admin)
    - GET /api/channels - Get channels (filtered)
    - GET /api/channels/:channelId - Get single channel
    - PUT /api/channels/:channelId/update - Update channel (Admin/Channel Admin)
    - DELETE /api/channels/:channelId/delete - Delete channel (Admin/Channel Admin)
    - POST /api/channels/:channelId/join - Join channel
    - DELETE /api/channels/:channelId/leave - Leave channel
    - GET /api/channels/:channelId/members - Get channel members
-   **Groups:**
    - POST /api/groups - Create group
    - GET /api/groups - Get groups (filtered)
    - GET /api/groups/:groupId - Get single group
    - PUT /api/groups/:groupId - Update group (Admin/Group Admin)
    - DELETE /api/groups/:groupId - Delete group (Admin/Group Admin)
    - POST /api/groups/:groupId/join - Join or request to join group
    - DELETE /api/groups/:groupId/leave - Leave group
    - GET /api/groups/:groupId/join-requests - Get join requests (Group Staff)
    - PUT /api/groups/:groupId/join-requests/:requestId - Manage join request (Group Staff)
    (Staff management routes: promote/demote admin/mod, kick member)
-   **Posts:**
    - POST /api/posts - Create post (in group/channel)
    - GET /api/posts - Get posts (filtered)
    - GET /api/posts/:postId - Get single post
    - PUT /api/posts/:postId - Update post (Owner)
    - DELETE /api/posts/:postId - Delete post (Owner/Admin)
    - PUT /api/posts/:postId/like - Like/unlike post
-   **Comments:**
    - POST /api/posts/:postId/comments - Create comment on post
    - GET /api/posts/:postId/comments - Get comments for post
    - PUT /api/comments/:commentId - Update comment (Owner)
    - DELETE /api/comments/:commentId - Delete comment (Owner/Admin)
    - PUT /api/comments/:commentId/like - Like/unlike comment
-   **Events:**
    - POST /api/events - Create event
    - GET /api/events - Get events (filtered)
    - GET /api/events/:eventId - Get single event
    - PUT /api/events/:eventId - Update event (Organizer/Admin)
    - DELETE /api/events/:eventId - Delete event (Organizer/Admin)
    - POST /api/events/:eventId/attend - Attend/Register for event
    - DELETE /api/events/:eventId/attend - Unregister from event
    - GET /api/events/:eventId/attendees - Get event attendees
-   **Chats:**
    - POST /api/chats/one-on-one - Get or create one-on-one chat
    - GET /api/chats - Get user's chats
    - GET /api/chats/:chatId - Get chat details
-   **Messages:**
    - POST /api/messages - Send message (with optional file)
    - GET /api/messages/:chatId - Get messages for a chat
    - PUT /api/messages/:messageId - Edit message
    - DELETE /api/messages/:messageId - Delete message
    - PUT /api/messages/read/:chatId - Mark messages as read
-   **Reports:**
    - POST /api/reports - Create a report
    - GET /api/reports - Get reports (Admin only)
    - PUT /api/reports/:reportId/resolve - Resolve a report (Admin only)

Note: All protected routes require a valid JWT in the Authorization: Bearer <token> header.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- AUTHORS -->

## 👥 Authors <a name="authors"></a>

👤 **Getayawkal Tamrat**

- GitHub: [@getssh](https://github.com/getssh/)
- LinkedIn: [Getayawkal Tamrat](https://www.linkedin.com/in/getayawkal-tamrat/)
- Email: [gtamrat33@gmail.com](mailto:gtamrat33@gmail.com)

👤 **BERIHUN TAREKEGN**

- Email: [taberihun07@gmail.com](mailto:taberihun07@gmail.com)

👤 **Binyam Tagel**

- Email: [binyam.tagel@gmail.com](mailto:binyam.tagel@gmail.com)

👤 **Fikadu**

- Email: [fikadu026@gmail.com](mailto:fikadu026@gmail.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- FUTURE FEATURES -->

### 🔭 Future Features <a name="future-features"></a>

-   **Advanced User Profiles:** Custom fields, portfolio links, skill endorsements.
-   **Notifications System:** Real-time and email notifications for likes, comments, mentions, event reminders, new group posts, etc.
-   **Enhanced Search:** Global search across posts, users, groups, events, with advanced filtering.
-   **Polls & Surveys:** Integrated into posts or groups.
-   **Resource Sharing Module:** Dedicated section for sharing academic resources (notes, past papers).
-   **Direct File Sharing between Users.**
-   **Full-fledged Calendar Integration for Events.**
-   **Admin Dashboard:** Comprehensive UI for system admins and university admins to manage users, content, reports, and platform settings.
-   **Gamification/Points System:** For user engagement.
-   **Internationalization (i18n) and Localization (l10n).**
-   **Improved Real-time Presence:** More detailed online/offline/idle status.
-   **Message Reactions for Chat Messages.** Already started
-   **Voice/Video Call Integration.**
-   **More granular permissions for Group/Channel staff.**
-   **AI intergrated study buddy:** Match students for study sessions
-   **Mock exam generator:** Add feature for students and staff to generate exams/questions based on submited files

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

### 🤝 Contributing <a name="contributing"></a>

Contributions, issues, and feature requests are welcome! We value the input from the community to make UNIverse Platform even better.

-   1. **Fork the Project**
-   2. **Create your Feature Branch** (git checkout -b feature/AmazingFeature)
-   3. **Commit your Changes** (git commit -m 'Add some AmazingFeature')
-   4. **Push to the Branch** (git push origin feature/AmazingFeature)
-   5. **Open a Pull Request**

Please make sure to update tests as appropriate and follow the existing code style.
Feel free to check the <a href="https://github.com/getssh/UNIverse_Backend/issues">issues</a> page for current tasks or to report new ones.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- SUPPORT -->

### ⭐️ Show your support <a name="support"></a>

If you find UNIverse Platform useful or interesting, please consider giving it a star on <a href="https://github.com/getssh/UNIverse_Backend" target="_blank">GitHub</a>! Your support helps motivate further development and showcases the project to a wider audience.

You can also contribute by reporting bugs, suggesting features, or submitting pull requests.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGEMENTS -->

### 🙏 Acknowledgements <a name="acknowledgements"></a>

-   All group members participated in the project
-   The vast open-source community for providing the excellent tools and libraries that made this project possible.
-   Gebeya and Safaricom for their support and the opportunity to work on this project

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

### 📝 License <a name="license"></a>
This project is licensed under the MIT License. See the LICENSE file for more details.

<p align="right">(<a href="#readme-top">back to top</a>)</p>