import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import './AdminDashboard.css';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [goals, setGoals] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0, totalMinutes: 0, activeSessions: 0, newUsersThisWeek: 0,
    totalSessions: 0, totalCourses: 0, totalRevisions: 0, totalMaterials: 0,
    avgSessionDuration: 0, completionRate: 0, activeStudentsToday: 0, avgGoalMinutes: 120
  });

  // Support chat state
  const [supportConversations, setSupportConversations] = useState([]);
  const [activeSupportConv, setActiveSupportConv] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const supportEndRef = useRef(null);
  const pollRef = useRef(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const res = await api.get('/auth/verify');
        if (res.data.valid && res.data.user.role === 'admin') setIsAdmin(true);
        else navigate('/dashboard');
      } catch { navigate('/login'); }
    };
    verifyAdmin();
  }, [navigate]);

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true); setError(null);
      const [studentsRes, sessionsRes, coursesRes, revisionsRes,
             materialsRes, notificationsRes, achievementsRes, statsRes, goalsRes] = await Promise.all([
        api.get('/admin/students'),
        api.get('/admin/sessions').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/courses').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/revisions').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/materials').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/notifications').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/achievements').catch(() => ({ data: { Result: [] } })),
        api.get('/admin/stats').catch(() => ({ data: { Data: {} } })),
        api.get('/admin/goals').catch(() => ({ data: { Result: [] } }))
      ]);

      const students    = studentsRes.data.Result     || [];
      const sessionData = sessionsRes.data.Result     || [];
      const courseData  = coursesRes.data.Result      || [];
      const revisionData  = revisionsRes.data.Result  || [];
      const materialData  = materialsRes.data.Result  || [];
      const notificationData = notificationsRes.data.Result || [];
      const achievementData  = achievementsRes.data.Result  || [];
      const statsData   = statsRes.data.Data          || {};
      const goalData    = goalsRes.data.Result         || [];

      setUsers(students); setSessions(sessionData); setCourses(courseData);
      setRevisions(revisionData); setMaterials(materialData);
      setNotifications(notificationData); setAchievements(achievementData);
      setGoals(goalData);

      const now = new Date();
      const totalMinutes = sessionData.reduce((acc, s) => acc + (parseInt(s.duration_minutes) || 0), 0);
      const activeSessions = sessionData.filter(s => s.status === 'active' || (!s.end_time && new Date(s.start_time) > subDays(now, 1))).length;
      const completedSessions = sessionData.filter(s => s.status === 'completed' || s.end_time).length;
      const avgGoalMinutes = goalData.length > 0
        ? Math.round(goalData.reduce((acc, g) => acc + (g.target_minutes || 0), 0) / goalData.length)
        : 120;

      setSystemStats({
        totalUsers: statsData.totalStudents || students.length,
        totalMinutes,
        activeSessions,
        newUsersThisWeek: students.filter(u => new Date(u.created_at) > subDays(now, 7)).length,
        totalSessions: statsData.totalSessions || sessionData.length,
        totalCourses: statsData.totalCourses || courseData.length,
        totalRevisions: revisionData.length,
        totalMaterials: materialData.length,
        avgSessionDuration: sessionData.length > 0 ? Math.round(totalMinutes / sessionData.length) : 0,
        completionRate: sessionData.length > 0 ? Math.round((completedSessions / sessionData.length) * 100) : 0,
        activeStudentsToday: statsData.activeStudentsToday || 0,
        avgGoalMinutes,
      });
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError('Failed to load admin data');
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

  // ─────────────────────────────────────────────────────
  // Support inbox
  // ─────────────────────────────────────────────────────
  const fetchSupportConversations = useCallback(async () => {
    try {
      const res = await api.get('/msg/admin/conversations');
      if (res.data.Status) {
        const convs = res.data.Result || [];
        setSupportConversations(convs);
        setSupportUnread(convs.reduce((acc, c) => acc + (c.unread_count || 0), 0));
      }
    } catch (err) { console.error('Support convs error:', err); }
  }, []);

  const fetchSupportMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/msg/conversations/${convId}/messages`);
      if (res.data.Status) {
        setSupportMessages(res.data.Result || []);
        setTimeout(() => supportEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (err) { console.error('Support messages error:', err); }
  }, []);

  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportConversations();
      pollRef.current = setInterval(() => {
        fetchSupportConversations();
        if (activeSupportConv) fetchSupportMessages(activeSupportConv.id);
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, activeSupportConv, fetchSupportConversations, fetchSupportMessages]);

  const openSupportConv = async (conv) => {
    setActiveSupportConv(conv);
    await fetchSupportMessages(conv.id);
    fetchSupportConversations();
  };

  const sendSupportReply = async (e) => {
    e.preventDefault();
    if (!supportInput.trim() || !activeSupportConv || sendingSupport) return;
    setSendingSupport(true);
    try {
      await api.post(`/msg/conversations/${activeSupportConv.id}/messages`, { content: supportInput.trim() });
      setSupportInput('');
      await fetchSupportMessages(activeSupportConv.id);
      fetchSupportConversations();
    } catch (err) { console.error('Send support reply error:', err); }
    finally { setSendingSupport(false); }
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); navigate('/logout'); }
    catch (err) { console.error('Logout error:', err); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this student and all their data?")) return;
    try {
      await api.delete(`/admin/students/${userId}`);
      setSuccess('Student deleted'); setTimeout(() => setSuccess(null), 3000);
      await fetchAdminData();
      if (isUserModalOpen) setIsUserModalOpen(false);
    } catch { setError('Failed to delete student'); setTimeout(() => setError(null), 3000); }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      await api.put(`/admin/students/${userId}/status`, { status: newStatus });
      setSuccess(`Status updated to ${newStatus}`); setTimeout(() => setSuccess(null), 3000);
      await fetchAdminData();
    } catch { setError('Failed to update status'); setTimeout(() => setError(null), 3000); }
  };

  // ─────────────────────────────────────────────────────
  // Analytics helpers
  // ─────────────────────────────────────────────────────
  const getDailyStats = useCallback(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      data.push({
        day: format(date, 'EEE'), date: dateStr,
        users: users.filter(u => u.created_at && format(parseISO(u.created_at), 'yyyy-MM-dd') === dateStr).length,
        sessions: sessions.filter(s => s.start_time && format(parseISO(s.start_time), 'yyyy-MM-dd') === dateStr).length
      });
    }
    return data;
  }, [users, sessions]);

  const getCourseSessionData = useCallback(() => {
    const counts = {};
    sessions.forEach(s => {
      const name = courses.find(c => c.id === s.course_id)?.course_name || 'General';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  }, [sessions, courses]);

  const getHourlyActivity = useCallback(() => {
    const hourCounts = new Array(24).fill(0);
    sessions.forEach(s => { if (s.start_time) hourCounts[new Date(s.start_time).getHours()]++; });
    const maxCount = Math.max(...hourCounts);
    return { peakHour: maxCount > 0 ? hourCounts.indexOf(maxCount) : null, data: hourCounts.map((count, hour) => ({ hour: `${hour.toString().padStart(2, '0')}:00`, sessions: count })) };
  }, [sessions]);

  const getTopCoursesByActivity = useCallback(() => {
    const stats = {};
    sessions.forEach(s => {
      const name = courses.find(c => c.id === s.course_id)?.course_name || 'General';
      if (!stats[name]) stats[name] = { minutes: 0, sessions: 0 };
      stats[name].minutes += s.duration_minutes || 0;
      stats[name].sessions += 1;
    });
    return Object.entries(stats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  }, [sessions, courses]);

  // ─────────────────────────────────────────────────────
  // RENDER: Overview
  // ─────────────────────────────────────────────────────
  const renderOverview = () => {
    const dailyStats = getDailyStats();
    const hourlyData = getHourlyActivity();
    return (
      <>
        <header className="admin-header">
          <div className="header-left"><h1>ADMIN DASHBOARD</h1><p>SYSTEM OVERVIEW • {format(new Date(), 'MMM dd, yyyy').toUpperCase()}</p></div>
          <div className="header-actions"><button className="btn-outline" onClick={fetchAdminData}>↻ REFRESH</button></div>
          {error && <div className="error-banner" onClick={() => setError(null)}>{error} ✕</div>}
          {success && <div className="success-banner" onClick={() => setSuccess(null)}>{success} ✕</div>}
        </header>

        <section className="admin-stat-grid">
          <div className="admin-stat-card large">
            <span className="card-label">TOTAL STUDENTS</span>
            <div className="stat-value">{systemStats.totalUsers}</div>
            <div className={`stat-trend ${systemStats.newUsersThisWeek > 0 ? 'up' : ''}`}>{systemStats.newUsersThisWeek > 0 ? `+${systemStats.newUsersThisWeek}` : '0'} THIS WEEK</div>
          </div>
          <div className="admin-stat-card"><span className="card-label">ACTIVE SESSIONS</span><div className="stat-value">{systemStats.activeSessions}</div><div className="live-pulse"><span className="pulse-dot"></span> LIVE NOW</div></div>
          <div className="admin-stat-card"><span className="card-label">TOTAL STUDY TIME</span><div className="stat-value">{Math.floor(systemStats.totalMinutes / 60)}H</div><div className="stat-sub">{systemStats.totalMinutes % 60} MINUTES</div></div>
          <div className="admin-stat-card"><span className="card-label">COURSES</span><div className="stat-value">{systemStats.totalCourses}</div><div className="stat-sub">ACROSS ALL STUDENTS</div></div>
          <div className="admin-stat-card"><span className="card-label">REVISIONS</span><div className="stat-value">{systemStats.totalRevisions}</div><div className="stat-sub">SCHEDULED</div></div>
          <div className="admin-stat-card"><span className="card-label">MATERIALS</span><div className="stat-value">{systemStats.totalMaterials}</div><div className="stat-sub">UPLOADED</div></div>
        </section>

        <div className="admin-lower-grid">
          <div className="admin-content-box chart-box">
            <h3>PLATFORM ACTIVITY (7 DAYS)</h3>
            <div className="chart-container">
              {dailyStats.some(d => d.users > 0 || d.sessions > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dailyStats}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/><stop offset="95%" stopColor="#FFD700" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.3}/><stop offset="95%" stopColor="#4ECDC4" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222"/><XAxis dataKey="day" stroke="#666"/><YAxis stroke="#666" allowDecimals={false}/>
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} formatter={(value, name) => [value, name === 'users' ? 'New Users' : 'Sessions']}/>
                    <Area type="monotone" dataKey="users" stroke="#FFD700" fillOpacity={1} fill="url(#colorUsers)" name="New Users"/>
                    <Area type="monotone" dataKey="sessions" stroke="#4ECDC4" fillOpacity={1} fill="url(#colorSessions)" name="Sessions"/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="no-data-message">No activity data yet</div>}
            </div>
          </div>

          <div className="admin-content-box">
            <h3>RECENT STUDENTS ({users.length} TOTAL)</h3>
            <div className="top-users-list">
              {users.slice(0, 5).map((u, i) => (
                <div key={u.id} className="top-user-item" onClick={() => { setSelectedUser(u); setIsUserModalOpen(true); }}>
                  <span className="rank">#{i + 1}</span>
                  <div className="user-info"><span className="user-name">{u.name}</span><span className="user-stats">{u.email} • {u.class_grade || 'N/A'}</span></div>
                  <div className="user-bar" style={{ width: `${Math.min((sessions.filter(s => s.student_id === u.id).length / Math.max(sessions.length / Math.max(users.length, 1), 1)) * 100, 100)}%`, background: COLORS[i % COLORS.length] }}></div>
                </div>
              ))}
              {users.length === 0 && <div className="no-data-message">No students registered yet</div>}
            </div>
          </div>
        </div>

        <div className="admin-content-box full-width">
          <h3>ALL STUDENTS ({users.length})</h3>
          <div className="users-table-container">
            <table className="admin-table">
              <thead><tr><th>ID</th><th>NAME</th><th>EMAIL</th><th>ROLL NUMBER</th><th>CLASS</th><th>SESSIONS</th><th>STATUS</th><th>JOINED</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {users.map(student => (
                  <tr key={student.id}>
                    <td className="mono">{student.id.toString().padStart(4, '0')}</td>
                    <td><div className="user-cell"><div className="user-avatar-small" style={{ background: COLORS[student.id % COLORS.length] }}>{student.name?.charAt(0).toUpperCase()}</div><span className="user-name-cell">{student.name}</span></div></td>
                    <td className="mono">{student.email}</td>
                    <td>{student.roll_number || '-'}</td>
                    <td>{student.class_grade || '-'}</td>
                    <td>{sessions.filter(s => s.student_id === student.id).length}</td>
                    <td><span className={`status-badge ${student.status}`}>{student.status}</span></td>
                    <td>{student.created_at ? format(parseISO(student.created_at), 'MMM dd, yyyy') : '-'}</td>
                    <td>
                      <button className="btn-text" onClick={() => { setSelectedUser(student); setIsUserModalOpen(true); }}>VIEW</button>
                      <button className="btn-text delete" onClick={() => handleDeleteUser(student.id)}>DELETE</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div className="no-data-message">No students in database</div>}
          </div>
        </div>
      </>
    );
  };

  // ─────────────────────────────────────────────────────
  // RENDER: Analytics
  // ─────────────────────────────────────────────────────
  const renderAnalytics = () => {
    const courseSessionData = getCourseSessionData();
    const hourlyData = getHourlyActivity();
    const topCourses = getTopCoursesByActivity();
    return (
      <>
        <header className="admin-header"><div className="header-left"><h1>SYSTEM ANALYTICS</h1><p>DEEP INSIGHTS & METRICS</p></div></header>
        <div className="admin-stat-grid three-col">
          <div className="admin-stat-card"><span className="card-label">AVG SESSION</span><div className="stat-value">{systemStats.avgSessionDuration}m</div></div>
          <div className="admin-stat-card"><span className="card-label">COMPLETION RATE</span><div className="stat-value">{systemStats.completionRate}%</div></div>
          <div className="admin-stat-card"><span className="card-label">PEAK HOUR</span><div className="stat-value">{hourlyData.peakHour !== null ? `${hourlyData.peakHour.toString().padStart(2, '0')}:00` : '--:--'}</div></div>
          <div className="admin-stat-card"><span className="card-label">ACTIVE TODAY</span><div className="stat-value">{systemStats.activeStudentsToday}</div></div>
          <div className="admin-stat-card"><span className="card-label">ACHIEVEMENTS EARNED</span><div className="stat-value">{achievements.length}</div></div>
          <div className="admin-stat-card"><span className="card-label">NOTIFICATIONS SENT</span><div className="stat-value">{notifications.length}</div></div>
          <div className="admin-stat-card"><span className="card-label">AVG DAILY GOAL</span><div className="stat-value">{Math.floor(systemStats.avgGoalMinutes / 60)}h {systemStats.avgGoalMinutes % 60}m</div><div className="stat-sub">ACROSS ALL STUDENTS</div></div>
          <div className="admin-stat-card"><span className="card-label">GOALS SET</span><div className="stat-value">{goals.length}</div><div className="stat-sub">TOTAL GOAL RECORDS</div></div>
        </div>
        <div className="admin-lower-grid">
          <div className="admin-content-box chart-box">
            <h3>HOURLY ACTIVITY DISTRIBUTION</h3>
            <div className="chart-container">
              {sessions.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}><BarChart data={hourlyData.data}><CartesianGrid strokeDasharray="3 3" stroke="#222"/><XAxis dataKey="hour" stroke="#666" interval={2}/><YAxis stroke="#666" allowDecimals={false}/><Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}/><Bar dataKey="sessions" fill="#FFD700" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
              ) : <div className="no-data-message">No session data available</div>}
            </div>
          </div>
          <div className="admin-content-box chart-box">
            <h3>TOP COURSES BY SESSIONS</h3>
            <div className="chart-container">
              {courseSessionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={courseSessionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="sessions">{courseSessionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}/></PieChart>
                </ResponsiveContainer>
              ) : <div className="no-data-message">No session data available</div>}
            </div>
          </div>
        </div>
        <div className="admin-content-box full-width">
          <h3>COURSE ACTIVITY RANKING</h3>
          <div className="top-courses-list">
            {topCourses.map((course, i) => (
              <div key={i} className="course-ranking-item">
                <span className="rank">#{i + 1}</span>
                <div className="course-info"><span className="course-name">{course.name}</span><span className="course-stats">{course.sessions} sessions • {course.minutes} minutes</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min((course.minutes / Math.max(...topCourses.map(c => c.minutes), 1)) * 100, 100)}%`, background: COLORS[i % COLORS.length] }}></div></div>
              </div>
            ))}
            {topCourses.length === 0 && <div className="no-data-message">No course activity data</div>}
          </div>
        </div>
        <div className="admin-content-box full-width">
          <h3>NEW REGISTRATIONS (LAST 7 DAYS)</h3>
          <div className="chart-container">
            {users.filter(u => u.created_at && new Date(u.created_at) > subDays(new Date(), 7)).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}><LineChart data={getDailyStats()}><CartesianGrid strokeDasharray="3 3" stroke="#222"/><XAxis dataKey="day" stroke="#666"/><YAxis stroke="#666" allowDecimals={false}/><Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}/><Line type="monotone" dataKey="users" stroke="#FFD700" strokeWidth={2} dot={{ fill: '#FFD700' }} name="New Registrations"/></LineChart></ResponsiveContainer>
            ) : <div className="no-data-message">No recent registration data</div>}
          </div>
        </div>
      </>
    );
  };

  // ─────────────────────────────────────────────────────
  // RENDER: Courses
  // ─────────────────────────────────────────────────────
  const renderCourses = () => (
    <>
      <header className="admin-header"><div className="header-left"><h1>ALL COURSES</h1><p>MANAGE COURSES ACROSS PLATFORM</p></div></header>
      <div className="admin-content-box full-width">
        <h3>COURSES ({courses.length})</h3>
        <div className="users-table-container">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>CODE</th><th>NAME</th><th>STUDENT</th><th>SESSIONS</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {courses.map(course => (
                <tr key={course.id}>
                  <td className="mono">{course.id}</td>
                  <td><span style={{ color: course.color, fontWeight: 'bold' }}>{course.course_code}</span></td>
                  <td>{course.course_name}</td>
                  <td>{course.student_name || 'Unknown'}</td>
                  <td>{course.session_count ?? sessions.filter(s => s.course_id === course.id).length}</td>
                  <td>{course.created_at ? format(parseISO(course.created_at), 'MMM dd, yyyy') : '-'}</td>
                  <td><button className="btn-text" onClick={() => { setSelectedCourse(course); setIsCourseModalOpen(true); }}>DETAILS</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {courses.length === 0 && <div className="no-data-message">No courses in database</div>}
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Support inbox
  // ─────────────────────────────────────────────────────
  const renderSupport = () => (
    <>
      <header className="admin-header">
        <div className="header-left"><h1>DEVELOPER SUPPORT</h1><p>STUDENT MESSAGES & QUESTIONS</p></div>
        <div className="header-actions"><button className="btn-outline" onClick={fetchSupportConversations}>↻ REFRESH</button></div>
      </header>

      <div className="support-layout">
        <div className="support-conv-list">
          <div className="support-list-header"><span>CONVERSATIONS ({supportConversations.length})</span>{supportUnread > 0 && <span className="support-unread-badge">{supportUnread} unread</span>}</div>
          {supportConversations.length === 0 ? (
            <div className="support-empty"><p>No student messages yet.</p><p>Students can reach you via the "ASK DEVELOPERS" button in their dashboard.</p></div>
          ) : (
            supportConversations.map(conv => (
              <div key={conv.id} className={`support-conv-item ${activeSupportConv?.id === conv.id ? 'active' : ''}`} onClick={() => openSupportConv(conv)}>
                <div className="support-conv-avatar">{conv.student_name?.charAt(0).toUpperCase()}</div>
                <div className="support-conv-info">
                  <span className="support-conv-name">{conv.student_name}</span>
                  <span className="support-conv-email">{conv.student_email}</span>
                  <span className="support-conv-last">{conv.last_message || 'No messages yet'}</span>
                </div>
                {conv.unread_count > 0 && <span className="support-unread-dot">{conv.unread_count}</span>}
              </div>
            ))
          )}
        </div>

        <div className="support-chat-area">
          {!activeSupportConv ? (
            <div className="support-chat-placeholder">
              <div className="support-placeholder-icon">🛠</div>
              <h3>DEVELOPER SUPPORT INBOX</h3>
              <p>Select a conversation from the left to view and reply to student messages.</p>
            </div>
          ) : (
            <>
              <div className="support-chat-header">
                <div className="support-chat-title">
                  <div className="support-chat-avatar">{activeSupportConv.student_name?.charAt(0).toUpperCase()}</div>
                  <div><span className="support-chat-name">{activeSupportConv.student_name}</span><span className="support-chat-email">{activeSupportConv.student_email}</span></div>
                </div>
                <button className="btn-icon" onClick={() => setActiveSupportConv(null)}>✕</button>
              </div>

              <div className="support-messages-list">
                {supportMessages.length === 0 ? (
                  <div className="support-empty center"><p>No messages yet in this conversation.</p></div>
                ) : (
                  supportMessages.map(msg => {
                    const isAdmin = msg.sender_type === 'admin';
                    return (
                      <div key={msg.id} className={`msg-bubble-wrap ${isAdmin ? 'mine' : 'theirs'}`}>
                        {!isAdmin && <span className="msg-sender-name">{msg.sender_name}</span>}
                        <div className={`msg-bubble ${isAdmin ? 'mine' : 'theirs'}`}>{msg.content}</div>
                        <span className="msg-time">{format(parseISO(msg.created_at), 'MMM dd, HH:mm')}</span>
                      </div>
                    );
                  })
                )}
                <div ref={supportEndRef} />
              </div>

              <form className="msg-input-row" onSubmit={sendSupportReply}>
                <input type="text" className="msg-input" placeholder={`Reply to ${activeSupportConv.student_name}...`} value={supportInput} onChange={e => setSupportInput(e.target.value)} autoComplete="off" />
                <button type="submit" className="msg-send-btn" disabled={!supportInput.trim() || sendingSupport}>{sendingSupport ? '...' : '→'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':  return renderOverview();
      case 'analytics': return renderAnalytics();
      case 'courses':   return renderCourses();
      case 'support':   return renderSupport();
      default: return null;
    }
  };

  if (!isAdmin) return <div className="loading-screen">AUTHENTICATING...</div>;

  return (
    <div className="admin-container">
      <nav className="admin-nav">
        <div className="nav-brand" onClick={() => setActiveTab('overview')}><span className="brand-icon">◈</span> DYNAMISM </div>
        <div className="nav-actions">
          <button className="nav-btn" onClick={() => navigate('/logout')}>EXIT ADMIN</button>
          <div className="profile-pill admin">
            <div className="p-avatar">A</div>
            <span className="p-name">ADMIN</span>
            <button className="logout-btn" onClick={handleLogout} title="Logout">⏻</button>
          </div>
        </div>
      </nav>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <ul className="admin-side-links">
            {[
              { id: 'overview',  icon: '◈', label: 'OVERVIEW' },
              { id: 'analytics', icon: '◉', label: 'ANALYTICS' },
              { id: 'courses',   icon: '📚', label: 'COURSES' },
              { id: 'support',   icon: '💬', label: 'SUPPORT', badge: supportUnread },
            ].map(item => (
              <li key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => setActiveTab(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge > 0 && <span className="admin-badge">{item.badge}</span>}
              </li>
            ))}
            <li onClick={() => navigate('/logout')} className="exit-item"><span className="nav-icon">←</span><span className="nav-label">EXIT TO APP</span></li>
          </ul>

          <div className="admin-info-box">
            <div className="info-row"><span className="info-label">SYSTEM</span><span className="info-value online">ONLINE</span></div>
            <div className="info-row"><span className="info-label">STUDENTS</span><span className="info-value">{users.length}</span></div>
            <div className="info-row"><span className="info-label">SESSIONS</span><span className="info-value">{sessions.length}</span></div>
            <div className="info-row"><span className="info-label">SUPPORT</span><span className={`info-value ${supportUnread > 0 ? 'online' : ''}`}>{supportUnread > 0 ? `${supportUnread} UNREAD` : 'UP TO DATE'}</span></div>
          </div>
        </aside>

        <main className="admin-main">{loading ? <div className="loading-screen">LOADING DATA...</div> : renderContent()}</main>
      </div>

      {isUserModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsUserModalOpen(false); }}>
          <div className="modal-content large">
            <div className="user-modal-header"><h3>STUDENT PROFILE</h3><button className="close-btn" onClick={() => setIsUserModalOpen(false)}>✕</button></div>
            <div className="user-profile-grid">
              <div className="profile-section">
                <div className="profile-avatar-large" style={{ background: COLORS[selectedUser.id % COLORS.length] }}>{selectedUser.name?.charAt(0).toUpperCase()}</div>
                <h2>{selectedUser.name}</h2>
                <p className="mono">{selectedUser.email}</p>
                <p className="joined">Joined {selectedUser.created_at ? format(parseISO(selectedUser.created_at), 'MMMM dd, yyyy') : 'Unknown'}</p>
                <span className={`status-badge large ${selectedUser.status}`}>{selectedUser.status}</span>
              </div>
              <div className="profile-stats">
                <div className="stat-block"><span className="stat-num">{selectedUser.roll_number || '-'}</span><span className="stat-label">ROLL NUMBER</span></div>
                <div className="stat-block"><span className="stat-num">{selectedUser.class_grade || '-'}</span><span className="stat-label">CLASS</span></div>
                <div className="stat-block"><span className="stat-num">{selectedUser.section || '-'}</span><span className="stat-label">SECTION</span></div>
                <div className="stat-block"><span className="stat-num">{selectedUser.phone || '-'}</span><span className="stat-label">PHONE</span></div>
                <div className="stat-block"><span className="stat-num">{sessions.filter(s => s.student_id === selectedUser.id).length}</span><span className="stat-label">SESSIONS</span></div>
                <div className="stat-block"><span className="stat-num">{revisions.filter(r => r.student_id === selectedUser.id).length}</span><span className="stat-label">REVISIONS</span></div>
                <div className="stat-block"><span className="stat-num">{sessions.filter(s => s.student_id === selectedUser.id).reduce((acc, s) => acc + (s.duration_minutes || 0), 0)}m</span><span className="stat-label">TOTAL MINUTES</span></div>
              </div>
            </div>
            <div className="user-activity-section">
              <h4>RECENT SESSIONS</h4>
              <div className="activity-list">
                {sessions.filter(s => s.student_id === selectedUser.id).slice(0, 5).map(session => (
                  <div key={session.id} className="activity-item"><span className="activity-type">Session</span><span className="activity-time">{session.start_time ? format(parseISO(session.start_time), 'MMM dd, HH:mm') : '-'}</span><span className="activity-duration">{session.duration_minutes || 0}m</span></div>
                ))}
                {sessions.filter(s => s.student_id === selectedUser.id).length === 0 && <p className="no-activity">No sessions yet</p>}
              </div>
            </div>
            <div className="modal-actions">
              <select className="status-select" value={selectedUser.status} onChange={e => handleUpdateUserStatus(selectedUser.id, e.target.value)}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
              </select>
              <button className="btn-outline" onClick={() => setIsUserModalOpen(false)}>CLOSE</button>
              <button className="btn-danger" onClick={() => handleDeleteUser(selectedUser.id)}>DELETE STUDENT</button>
            </div>
          </div>
        </div>
      )}

      {isCourseModalOpen && selectedCourse && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsCourseModalOpen(false); }}>
          <div className="modal-content">
            <div className="user-modal-header"><h3>COURSE DETAILS</h3><button className="close-btn" onClick={() => setIsCourseModalOpen(false)}>✕</button></div>
            <div className="course-detail-header" style={{ borderLeftColor: selectedCourse.color }}><h2 style={{ color: selectedCourse.color }}>{selectedCourse.course_code}</h2><p>{selectedCourse.course_name}</p><span className="student-tag">By: {selectedCourse.student_name}</span></div>
            <div className="course-stats-grid">
              <div className="stat-block"><span className="stat-num">{selectedCourse.session_count ?? sessions.filter(s => s.course_id === selectedCourse.id).length}</span><span className="stat-label">SESSIONS</span></div>
              <div className="stat-block"><span className="stat-num">{materials.filter(m => m.course_id === selectedCourse.id).length}</span><span className="stat-label">MATERIALS</span></div>
              <div className="stat-block"><span className="stat-num">{sessions.filter(s => s.course_id === selectedCourse.id).reduce((acc, s) => acc + (s.duration_minutes || 0), 0)}m</span><span className="stat-label">TOTAL MINUTES</span></div>
            </div>
            <div className="modal-actions"><button className="btn-outline" onClick={() => setIsCourseModalOpen(false)}>CLOSE</button></div>
          </div>
        </div>
      )}
    </div>
  );
}