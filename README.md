# SignSense: Interactive Sign Language Learning Platform

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://www.python.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Latest-blue?logo=google)](https://mediapipe.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.5-EE4C2C?logo=pytorch)](https://pytorch.org/)

**SignSense** is a gamified, real-time Sign Language learning platform that leverages AI and computer vision to help users master ASL (American Sign Language). By providing instant feedback on handshapes, orientation, and movement, SignSense makes learning sign language intuitive, engaging, and effective.

---

## 🌟 Key Features

-   **🎯 Real-time Recognition**: Instant feedback on your signs using MediaPipe-powered landmark detection.
-   **📈 Gamified Learning Path**: Progress through a skill tree (Alphabet Mastery, WLASL concepts) and earn XP and streaks.
-   **🔍 Detailed Execution Analysis**: Feedback broken down by **Handshape**, **Movement**, and **Orientation**.
-   **🕹️ Free Practice Mode**: Jump straight into practicing any sign with live confidence scoring.
-   **📊 Progress Tracking**: Monitor your mastery across letters and vocabulary segments.

---

## 📸 Screenshots

### 🏠 Landing Page
![Landing Page](docs/images/landing_page.png)
*Welcome to SignSense - start your journey with a quick practice session or track your recent stats.*

### 🗺️ Learning Path (Skill Tree)
![Dashboard](docs/images/dashboard.png)
*Unlock new lessons as you progress through the Alphabet and WLASL curriculum.*

### 📚 Interactive Lessons
![Lesson View](docs/images/lesson_view.png)
*Master individual letters with real-time feedback and execution analysis.*

### ⚡ Practice Mode
![Practice Mode](docs/images/practice_mode.png)
*Hone your skills with focused practice on specific target letters.*

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Computer Vision**: [@mediapipe/tasks-vision](https://developers.google.com/mediapipe/solutions/vision)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **ML Engine**: [PyTorch](https://pytorch.org/) & [NumPy](https://numpy.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [SQLAlchemy](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/)
- **Task Queue**: [Celery](https://docs.celeryq.dev/) (for long-running ML tasks)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL (if running locally)

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Developed with ❤️ for the Sign Language community.
