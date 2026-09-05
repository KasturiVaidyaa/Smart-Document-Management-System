
## Tech Stack

| Layer    | Technologies                                          |
| -------- | ----------------------------------------------------- |
| Frontend | React 19, Vite 7, Tailwind CSS 4, Framer Motion       |
| Backend  | Express 5, Mongoose, JWT, Cloudinary, Nodemailer       |
| Database | MongoDB                                               |

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB Atlas](https://www.mongodb.com/atlas) cloud cluster
- [Cloudinary](https://cloudinary.com/) account (for file uploads)
- Gmail account with [App Password](https://support.google.com/accounts/answer/185833) (for email features)

---

## Project Structure

```
Hackathon-Template/
├── backend/           
├── frontend/
├── package.json           # Root package (backend deps + scripts)
└── .env                   # Environment variables (create this)
```

---

## Environment Variables

Create a `.env` file in the **project root** directory:

```env
# Server
PORT=5005

# MongoDB
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/

# JWT
JWT_SEC=your_jwt_secret_key

# Cloudinary
Cloud_Name=your_cloudinary_cloud_name
Cloud_Api=your_cloudinary_api_key
Cloud_Secret=your_cloudinary_api_secret

# Email (Gmail + App Password)
MY_GMAIL=your_email@gmail.com
MY_PASS=your_gmail_app_password
```

> **Note:** Never commit the `.env` file. It is already listed in `.gitignore`.

---

## Setup & Installation

### 1. Clone the repository


### 2. Install backend dependencies

```bash
npm install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Create your `.env` file

Copy the template from the [Environment Variables](#environment-variables) section above and fill in your actual values.

---

## Running the App

### Development (backend + frontend separately)

**Terminal 1 — Backend** (runs on `http://localhost:5005`):

```bash
npm run dev
```

**Terminal 2 — Frontend** runs on `http://localhost:5173`

```bash
cd frontend
npm run dev
```





---

## Available Scripts

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Start backend with nodemon (hot-reload)            |
| `npm start`       | Start backend with node (production)               |


---

## API Routes

All API routes are prefixed with `/api`:

| Prefix       | Description      |
| ------------ | ---------------- |
| `/api/user`  | User auth routes |

---