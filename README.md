# Student Information Management System (SIMS)
### Three-Tier Cloud Architecture &middot; College Cloud Computing Assignment

[![Frontend: Netlify](https://img.shields.io/badge/Tier_1-Netlify_Frontend-00C7B7?style=flat&logo=netlify&logoColor=white)](https://www.netlify.com/)
[![Backend: Render](https://img.shields.io/badge/Tier_2-Render_Express_API-46E3B7?style=flat&logo=render&logoColor=white)](https://render.com/)
[![Database: MongoDB Atlas](https://img.shields.io/badge/Tier_3-MongoDB_Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/cloud/atlas)

A complete, production-ready, full-stack Student Information Management System built for a college cloud computing assignment, demonstrating true **Three-Tier Cloud Architecture** deployed across independent cloud providers.

---

## 1. Project Overview & Objectives

### Objective
To architect, develop, and deploy an enterprise-pattern Student Information Management System where each architectural tier runs independently in the cloud:

1. **Tier 1 &mdash; Presentation Layer:** Static web frontend hosted globally on **Netlify CDN**.
2. **Tier 2 &mdash; Application Layer:** REST API server built with **Node.js & Express.js** hosted on **Render Web Services**.
3. **Tier 3 &mdash; Database Layer:** Document database hosted on **MongoDB Atlas** cloud cluster.

### Three-Tier Architecture Flowchart

```
                 +-----------------------------------------+
                 |              USER / BROWSER             |
                 +--------------------+--------------------+
                                      |
                                      | HTTPS (Port 443)
                                      v
+--------------------------------------------------------------------------+
|                       TIER 1: PRESENTATION LAYER                         |
|                            (Hosted on Netlify)                           |
|                                                                          |
|  - HTML5, CSS3 (Professional Blue/White Theme), Vanilla JavaScript       |
|  - Dynamic Dashboard (Total Students, Department Breakdown, Semesters)   |
|  - Student Registration Form, Search, Edit, Delete Confirmation          |
|  - REST Client connecting to Tier 2 via HTTPS                            |
+-------------------------------------+------------------------------------+
                                      |
                                      | HTTPS REST API Calls
                                      | (JSON over HTTPS)
                                      v
+--------------------------------------------------------------------------+
|                        TIER 2: APPLICATION LAYER                         |
|                            (Hosted on Render)                            |
|                                                                          |
|  - Node.js & Express.js REST API Server                                  |
|  - CORS Whitelisting for Authorized Netlify Domain                       |
|  - Business Logic, Input Validation & Duplicate ID Prevention            |
|  - Endpoints: GET, POST, PUT, DELETE /api/students & /health             |
+-------------------------------------+------------------------------------+
                                      |
                                      | TLS Encrypted Connection
                                      | (Mongoose ODM / mongodb+srv://)
                                      v
+--------------------------------------------------------------------------+
|                          TIER 3: DATABASE LAYER                          |
|                        (Hosted on MongoDB Atlas)                         |
|                                                                          |
|  - Cloud-Managed Document Database                                       |
|  - Database: studentDB                                                   |
|  - Collection: students                                                  |
|  - Enforced schema: studentId (unique), name, email, department, sem     |
+--------------------------------------------------------------------------+
```

---

## 2. Technology Stack

| Layer | Component | Technology | Cloud Host |
|---|---|---|---|
| **Tier 1** | Presentation Layer | HTML5, CSS3, Vanilla JavaScript (ES6+), Font Awesome | **Netlify** |
| **Tier 2** | Application Layer | Node.js (v22+), Express.js (v4.21+), CORS, Dotenv | **Render** |
| **Tier 3** | Database Layer | MongoDB Atlas, Mongoose (v8.9+) ODM | **MongoDB Atlas** |
| **Protocol** | Communication | REST APIs, JSON data format over HTTPS / TLS | &mdash; |

---

## 3. Project File Structure

```
Student_management_sytem/
│
├── .gitignore                      # Excludes node_modules, .env, and local credentials
├── README.md                       # Comprehensive documentation & presentation guide
│
├── frontend/                       # TIER 1: Presentation Layer
│   ├── index.html                  # Accessible dashboard with search, table, & modals
│   ├── style.css                   # Professional blue-and-white theme & responsive styles
│   ├── app.js                      # REST client with CRUD, health check & UI states
│   └── netlify.toml                # Netlify deployment rules & security headers
│
└── backend/                        # TIER 2: Application Layer
    ├── config/
    │   └── db.js                   # Mongoose connection to MongoDB Atlas
    ├── models/
    │   └── Student.js              # Mongoose schema with validation & uniqueness
    ├── controllers/
    │   └── studentController.js    # CRUD business logic, duplicate checks, errors
    ├── routes/
    │   └── studentRoutes.js        # Express routes mapping /api/students
    ├── server.js                   # Express server bootstrap, CORS, /health check
    ├── package.json                # Dependencies: express, mongoose, cors, dotenv
    ├── .env.example                # Configuration template (safe for Git)
    └── .env                        # Local environment secrets (IGNORED BY GIT)
```

---

## 4. Student Data Model

Every student record adheres to the following specification:

| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `studentId` | `String` | **Yes** | Unique identifier (e.g., `STU-1001`), trimmed, uppercase |
| `name` | `String` | **Yes** | Full student name (minimum 2 characters) |
| `email` | `String` | **Yes** | Valid university/personal email address |
| `department` | `String` | **Yes** | Academic department (CS, IT, ME, EE, CE, BA, DS, AI) |
| `semester` | `Number` | **Yes** | Numeric semester (integer between 1 and 8) |
| `contact` | `String` | *No* | Contact phone number |
| `createdAt` | `Date` | Auto | Timestamp created by MongoDB Atlas |
| `updatedAt` | `Date` | Auto | Timestamp updated by MongoDB Atlas |

---

## 5. REST API Documentation

Base URL:
- Local: `http://localhost:5000`
- Render: `https://<your-render-service>.onrender.com`

### 1. Health Check
- **Route:** `GET /health`
- **Description:** Verifies Tier 2 API status, uptime, and Tier 3 database connectivity.
- **Response (200 OK):**
```json
{
  "status": "OK",
  "tier": "Tier 2 - Application Layer (Express.js on Render)",
  "databaseTier": "Tier 3 - MongoDB Atlas",
  "databaseStatus": "connected",
  "timestamp": "2026-10-14T14:30:00.000Z",
  "uptime": "120s"
}
```

### 2. Retrieve All Students
- **Route:** `GET /api/students`
- **Optional Query:** `GET /api/students?search=eleanor`
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "670d306b9b1e9c5f2b87a123",
      "studentId": "STU-1001",
      "name": "Eleanor Vance",
      "email": "eleanor@university.edu",
      "department": "Computer Science",
      "semester": 4,
      "contact": "+1 (555) 234-5678",
      "createdAt": "2026-10-14T14:31:00.000Z"
    }
  ]
}
```

### 3. Retrieve Student by ID
- **Route:** `GET /api/students/:id`
- **Param:** `:id` can be either `studentId` (e.g. `STU-1001`) or MongoDB `_id`.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "studentId": "STU-1001",
    "name": "Eleanor Vance",
    "email": "eleanor@university.edu",
    "department": "Computer Science",
    "semester": 4,
    "contact": "+1 (555) 234-5678"
  }
}
```

### 4. Register New Student
- **Route:** `POST /api/students`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "studentId": "STU-1001",
  "name": "Eleanor Vance",
  "email": "eleanor@university.edu",
  "department": "Computer Science",
  "semester": 4,
  "contact": "+1 (555) 234-5678"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "Student record registered successfully in MongoDB Atlas",
  "data": { ... }
}
```

### 5. Update Student Record
- **Route:** `PUT /api/students/:id`
- **Request Body (partial or full updates):**
```json
{
  "semester": 5,
  "contact": "+1 (555) 999-8888"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Student record \"STU-1001\" updated successfully",
  "data": { ... }
}
```

### 6. Delete Student Record
- **Route:** `DELETE /api/students/:id`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Student \"Eleanor Vance\" (ID: STU-1001) successfully deleted from MongoDB Atlas"
}
```

---

## 6. Local Setup & Execution

### Prerequisites
- Node.js (v18 or higher) installed (`node -v`)
- Git installed (`git -v`)
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account

### Step 1: Clone Repository
```bash
git clone <your-repository-url>
cd Student_management_sytem
```

### Step 2: Configure Backend Environment Variables
Navigate to the `backend/` directory:
```bash
cd backend
npm install
```

Create your `.env` file from the provided template:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On Mac/Linux:
cp .env.example .env
```

Open `backend/.env` and configure:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/studentDB?retryWrites=true&w=majority
FRONTEND_URL=*
```

### Step 3: Run the Backend Server
```bash
# Production mode:
npm start

# Development mode (auto-reload on save):
npm run dev
```
The server will start on `http://localhost:5000`.

### Step 4: Run the Frontend
Simply open `frontend/index.html` in your web browser:
- Double click `frontend/index.html`, OR
- Use the VS Code Live Server extension, OR
- Run a simple local HTTP server:
  ```bash
  npx serve frontend
  ```

---

## 7. Cloud Deployment Step-by-Step

### Tier 3: MongoDB Atlas Setup
1. **Create Account & Cluster:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and register.
   - Click **Create Deployment** &rarr; select **M0 Free Tier** &rarr; choose your nearest cloud region &rarr; click **Create**.
2. **Create Database User:**
   - Go to **Security** &rarr; **Database Access** &rarr; **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `student_admin`
   - Password: Click **Autogenerate Secure Password** (save this password safely!).
   - Database User Privileges: `Read and write to any database`.
3. **Configure Network Access (Firewall):**
   - Go to **Security** &rarr; **Network Access** &rarr; **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - *(Note: Render uses dynamic IPs, so allowing `0.0.0.0/0` is required for cloud hosting).*
4. **Obtain Connection String:**
   - Go to **Database** &rarr; click **Connect** on your cluster.
   - Choose **Drivers** &rarr; Driver: **Node.js**.
   - Copy the connection URI:
     `mongodb+srv://student_admin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
   - Add `/studentDB` before the `?` query parameter:
     `mongodb+srv://student_admin:<password>@cluster0.xxxx.mongodb.net/studentDB?retryWrites=true&w=majority`

---

### Tier 2: Render Deployment (Express REST API)
1. Push your repository to **GitHub**.
2. Log in to [Render](https://render.com/).
3. Click **New +** &rarr; **Web Service**.
4. Connect your GitHub repository.
5. Configure the service settings:
   - **Name:** `student-management-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
6. Click **Environment Variables** and add:
   - `MONGODB_URI` = `<Your MongoDB Atlas connection string with real password>`
   - `FRONTEND_URL` = `https://<your-app-name>.netlify.app` (or `*` during initial testing)
7. Click **Create Web Service**.
8. Once deployed, copy your Render URL: `https://student-management-sytem-2ehv.onrender.com`.
9. Test by opening `https://student-management-sytem-2ehv.onrender.com/health` in your browser.

---

### Tier 1: Netlify Deployment (Presentation Layer)
1. Log in to [Netlify](https://www.netlify.com/).
2. Click **Add new site** &rarr; **Import an existing project**.
3. Authorize GitHub and select your repository.
4. Configure Build settings:
   - **Base directory:** `frontend`
   - **Publish directory:** `frontend`
   - **Build command:** *(leave empty, static files only)*
5. Click **Deploy Site**.
6. Once deployed, open your live Netlify dashboard:
   - Click the **Gear icon** in the top navigation bar of the application.
   - Click **Use Render Cloud** (or paste `https://student-management-sytem-2ehv.onrender.com`).
   - Click **Save & Connect**.
   - The indicator turns green: **API Connected (Tier 2)**!

---

## 8. Verification & Testing Guide

You can test all 12 scenarios using `curl` or [Postman](https://www.postman.com/):

### Test 1: Add a New Student
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "STU-1001",
    "name": "Eleanor Vance",
    "email": "eleanor@university.edu",
    "department": "Computer Science",
    "semester": 4,
    "contact": "+1 (555) 234-5678"
  }'
```
*Expected: HTTP 201 Created.*

### Test 2: Display All Students
```bash
curl -X GET http://localhost:5000/api/students
```
*Expected: HTTP 200 OK with array containing student records.*

### Test 3: Search by Student ID
```bash
curl -X GET http://localhost:5000/api/students/STU-1001
```
*Expected: HTTP 200 OK with Eleanor Vance's record.*

### Test 4: Update Student's Semester
```bash
curl -X PUT http://localhost:5000/api/students/STU-1001 \
  -H "Content-Type: application/json" \
  -d '{"semester": 5}'
```
*Expected: HTTP 200 OK with updated semester: 5.*

### Test 5: Delete a Student
```bash
curl -X DELETE http://localhost:5000/api/students/STU-1001
```
*Expected: HTTP 200 OK with deletion confirmation message.*

### Test 6: Prevent Duplicate Student IDs
```bash
# Execute Test 1 twice with the same studentId "STU-1001"
```
*Expected: HTTP 400 Bad Request with message "Student with ID STU-1001 already exists".*

### Test 7: Handle Invalid Form Data (Missing Fields)
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"name": "Incomplete Student"}'
```
*Expected: HTTP 400 Bad Request listing missing required fields.*

### Test 8: Handle Non-Existent Student ID
```bash
curl -X GET http://localhost:5000/api/students/NON-EXISTENT-ID
```
*Expected: HTTP 404 Not Found with error message.*

### Test 9: Verify Records in MongoDB Atlas
- Log in to MongoDB Atlas &rarr; Click **Database** &rarr; **Browse Collections** &rarr; `studentDB` &rarr; `students`.
- Verify the document matches the schema.

### Test 10: Verify Frontend-to-Backend Communication
- Open the frontend in the browser, register a student, verify immediate addition to table and live stats update.

### Test 11: CORS Verification
- The backend rejects requests from non-whitelisted origins when `FRONTEND_URL` is set to your Netlify domain.

### Test 12: End-to-End Deployed Application
- Open the deployed Netlify URL on any phone, tablet, or PC, register a student, and see it persist in MongoDB Atlas through the Render API.

---

## 9. Common Errors & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| **CORS Error in Browser Console** | Backend `FRONTEND_URL` doesn't match the Netlify origin. | Update `FRONTEND_URL` in Render environment variables to match your exact Netlify domain (e.g. `https://my-app.netlify.app`). |
| **503 Service Unavailable** | Backend cannot connect to MongoDB Atlas. | 1. Ensure `0.0.0.0/0` is allowed in MongoDB Atlas Network Access.<br>2. Check password in `MONGODB_URI` does not contain unescaped special characters.<br>3. Verify database user privileges. |
| **Render Free Tier Spin-Down Delay** | Free tier web services go to sleep after 15 minutes of inactivity. | The first request takes 30-50 seconds to wake up. The frontend status pill clearly shows "Checking API..." until awake. |
| **Duplicate Key Error (E11000)** | A student with the same `studentId` or `email` already exists. | Use a different student ID or delete the existing record first. |

---

## 10. College Assignment Presentation Guide

When presenting this project to your professor or viva examiner:

1. **Explain the 3-Tier Architecture:**
   - *"Our system separates concerns into three distinct cloud layers: Tier 1 (Netlify) handles user interaction, Tier 2 (Render) executes business logic and security policies, and Tier 3 (MongoDB Atlas) provides persistent cloud data storage."*
2. **Security & Decoupling:**
   - *"The frontend never communicates directly with MongoDB; all database credentials remain securely hidden in Render environment variables."*
3. **Live Demonstration Sequence:**
   - Show the **Health Check** (`/health`) proving all tiers are live.
   - Show the **Add Student** form with validation.
   - Demonstrate **Search & Filter** in real time.
   - Demonstrate **Edit** updating semester in MongoDB.
   - Demonstrate **Duplicate Prevention** by typing the same student ID.
   - Open MongoDB Atlas **Browse Collections** to prove real database persistence.
   - Demonstrate **Delete** with confirmation prompt.

---

## License & Attribution
Developed for College Cloud Computing Course Assignment. Licensed under the ISC License.
