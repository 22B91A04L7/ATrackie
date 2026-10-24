# ATrackie – AI-Powered Job Application Tracker

ATrackie is a full-stack job application tracking platform that helps users save and manage job opportunities directly while browsing job websites.

It combines a web dashboard with a Chrome extension, allowing users to capture job postings without manually copying job details into a tracker.

---

## ✨ Features

- 🔐 JWT-based user authentication
- 📧 Email format validation during registration
- 🌐 Chrome extension for capturing job postings
- 🤖 AI-powered job information extraction using Groq AI
- 📋 Automatic extraction of job details such as:
  - Job title
  - Company
  - Salary
  - Skills
  - Responsibilities
  - Experience
  - Education
- 🔗 Duplicate job detection using normalized job URLs
- 📝 Manual job entry
- 📊 Dashboard for managing saved applications
- 🔄 Update application status
- 🗑️ Delete individual applications
- ☑️ Bulk delete applications
- 🔔 Pending application reminder through the Chrome extension badge
- 🔑 Extension authentication synchronized with the web application
- 👤 User-specific job application data

---

## 🛠️ Tech Stack

### Frontend

- React.js
- JavaScript
- CSS
- Vite

### Backend

- Node.js
- Express.js
- RESTful APIs
- JWT Authentication
- bcryptjs

### Database

- MongoDB
- Mongoose
- MongoDB Atlas

### AI

- Groq AI
- Groq SDK

### Chrome Extension

- React
- JavaScript
- Chrome Extension Manifest V3
- Vite
- CRXJS
- Chrome Storage API
- Chrome Tabs API

### Development Tools

- Git
- GitHub
- Postman
- VS Code
- MySQL Workbench
- Chrome DevTools

---

## 🏗️ Project Architecture

```text
                         ┌──────────────────────┐
                         │     Job Websites     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   ATrackie Chrome    │
                         │      Extension       │
                         │                      │
                         │  • Job Extraction    │
                         │  • Duplicate Check   │
                         │  • Job Tracking      │
                         │  • Authentication    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Express.js API    │
                         │                      │
                         │  • REST APIs         │
                         │  • JWT Auth          │
                         │  • Job Management    │
                         │  • AI Extraction     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     MongoDB Atlas    │
                         │                      │
                         │  • Users             │
                         │  • Applications      │
                         └──────────────────────┘
                                    ▲
                                    │
                         ┌──────────┴───────────┐
                         │   React Dashboard    │
                         │                      │
                         │  • View Jobs         │
                         │  • Update Status     │
                         │  • Delete Jobs       │
                         │  • Manage Applications│
                         └──────────────────────┘
