# Dynamism: Smart Study & Learning Manager

**Dynamism** is a modern, full-stack web application designed to help students optimize their academic performance through data-driven study tracking, resource management, and collaborative features.

## 🚀 Key Features

### 📊 Real-time Study Tracking
* **Live Session Timer**: Start and end study sessions with a high-precision timer to track focus periods.
* **Course Attribution**: Link study sessions to specific subjects for detailed productivity breakdowns.
* **Daily Goals**: Set and monitor daily study time targets with visual progress indicators.

### 📚 Academic Organization
* **Course Management**: Create, edit, and categorize subjects with custom color-coding.
* **Material Repository**: Upload and organize study materials (PDFs, links, notes, videos) by course.
* **Revision Planner**: Schedule upcoming revision sessions and view them in an integrated calendar.

### 📈 Analytics & Insights
* **Study Patterns**: Visualize your weekly activity using interactive bar and line charts.
* **Subject Distribution**: Analyze which courses receive the most focus through course-specific statistics.
* **Streak System**: Maintain daily study streaks to build consistent learning habits.

### 🏆 Gamification & Social
* **Achievement System**: Earn trophies like "Early Bird," "Night Owl," and "Master Scholar" based on your study behavior.
* **Messaging & Collaboration**: Add friends, search for peers, and engage in real-time chat with students or administrators.
* **Motivational Quotes**: Stay inspired with a rotating selection of philosophical and motivational quotes.

## 🛠️ Tech Stack

* **Frontend**: React.js (Vite), Recharts (for data visualization), date-fns.
* **Backend**: Node.js & Express.
* **State Management**: React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`).
* **Communication**: Axios for API requests.

## 🔧 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/dynamism.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**:
   Ensure your backend is running at `http://localhost:3000` (default configuration).
4. **Run the application**:
   ```bash
   npm run dev
   ```

---

### UI Preview
The application features a sleek "SpaceX-inspired" aesthetic with a responsive dashboard layout including:
* **Sidebar Navigation**: Quick access to Dashboard, Sessions, Courses, Calendar, and Messages.
* **Notification System**: Stay updated on friend requests and upcoming deadlines.
* **User Settings**: Manage personal profiles, academic details, and security.
