import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

import {
  format, subDays, startOfWeek, addDays, isSameDay,
  parseISO, startOfMonth, subMonths, addMonths // <--- Add these two
} from 'date-fns';
import { useAuth } from './AuthContext';
import './Dashboard.css';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [courses, setCourses] = useState([]);
  const [todayStats, setTodayStats] = useState({ totalMinutes: 0, targetMinutes: 120, percentage: 0, formattedTime: '0H 00M' });
  const [streakData, setStreakData] = useState({ currentStreak: 0, weekData: [] });
  const [sessionHistory, setSessionHistory] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [revisionSessions, setRevisionSessions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [studyGoal, setStudyGoal] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInputHours, setGoalInputHours] = useState('');
  const [goalInputMins, setGoalInputMins] = useState('');

  // Messaging state
  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [msgUnreadCount, setMsgUnreadCount] = useState(0);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendsSubTab, setFriendsSubTab] = useState('chats'); // 'chats' | 'friends' | 'search'
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [currentCourse, setCurrentCourse] = useState({ code: '', name: '', color: '#FFD700' });
  const [currentRevision, setCurrentRevision] = useState({ courseId: '', title: '', scheduledDate: format(new Date(), 'yyyy-MM-dd'), duration: 60, priority: 'medium', status: 'pending' });
  const [currentMaterial, setCurrentMaterial] = useState({ courseId: '', title: '', type: 'pdf', url: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeSession, setActiveSession] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [selectedCourseForSession, setSelectedCourseForSession] = useState('');

  const [settingsForm, setSettingsForm] = useState({ name: user?.name || '', email: user?.email || '', roll_number: '', class_grade: '', section: '', phone: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const quotes = useMemo(() => [
    { text: "We are what we repeatedly do.", author: "Aristotle" },
    { text: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius" },
    { text: "The soul becomes dyed with the color of its thoughts.", author: "Heraclitus" },
    { text: "He who has a why to live can bear almost any how.", author: "Nietzsche" },
    { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" }
  ], []);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

  // ─────────────────────────────────────────────────────
  // Fetch dashboard data
  // Each request is individually wrapped so a single
  // failing endpoint never crashes the whole dashboard.
  // ─────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    // safe() turns any rejected promise into { data: {} }
    const safe = (p) => p.catch(() => ({ data: {} }));

    const [coursesRes, todayRes, streakRes, historyRes, analyticsRes,
      revisionRes, materialsRes, notificationsRes, goalsRes, achievementsRes] = await Promise.all([
        safe(api.get('/courses/all')),
        safe(api.get('/sessions/today')),
        safe(api.get('/sessions/streaks')),
        safe(api.get('/sessions/history?limit=50')),
        safe(api.get('/dataroom/stats')),
        safe(api.get('/revisions/all')),
        safe(api.get('/materials/all')),
        safe(api.get('/notifications/all')),
        safe(api.get('/goals/current')),
        safe(api.get('/achievements/all')),
      ]);

    const fetchedCourses = coursesRes.data?.Status ? (coursesRes.data.Result || []) : [];
    setCourses(fetchedCourses);
    if (todayRes.data?.Status) setTodayStats(todayRes.data.Data || { totalMinutes: 0, targetMinutes: 120, percentage: 0, formattedTime: '0H 00M' });
    const streakResult = streakRes.data?.Status ? (streakRes.data.Data || { currentStreak: 0, weekData: [] }) : { currentStreak: 0, weekData: [] };
    setStreakData(streakResult);
    const fetchedHistory = historyRes.data?.Status ? (historyRes.data.Result || []) : [];
    setSessionHistory(fetchedHistory);
    if (analyticsRes.data?.Status) setAnalyticsData(analyticsRes.data.Data);
    if (revisionRes.data?.Status) {
      const revisions = revisionRes.data.Result || [];
      setRevisionSessions(revisions);
      setCalendarEvents(revisions.map(r => ({
        id: r.id,
        date: format(parseISO(r.scheduled_date), 'yyyy-MM-dd'),
        title: r.title,
        course: fetchedCourses.find(c => c.id === r.course_id)?.course_code || 'General',
        color: fetchedCourses.find(c => c.id === r.course_id)?.color || '#FFD700',
        completed: r.status === 'completed'
      })));
    }
    if (materialsRes.data?.Status) setMaterials(materialsRes.data.Result || []);
    if (notificationsRes.data?.Status) {
      const notifs = notificationsRes.data.Result || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    }
    if (goalsRes.data?.Status) setStudyGoal(goalsRes.data.Result);

    // Build trophies from the new single-row achievements design.
    // The backend returns { keys_earned: [], progress_map: {} }.
    // keys_earned is a CSV string of earned badge IDs.
    // progress_map is a JSON object of { badgeId: progressNumber }.
    // calculateTrophies reads these instead of recomputing from sessions.
    const achResult = achievementsRes.data?.Status
      ? (achievementsRes.data.Result || { keys_earned: [], progress_map: {} })
      : { keys_earned: [], progress_map: {} };
    calculateTrophies(achResult, streakResult.currentStreak);

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  // ─────────────────────────────────────────────────────
  // Messaging data fetchers
  // ─────────────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/msg/friends/list');
      if (res.data.Status) setFriends(res.data.Result || []);
    } catch (err) { console.error('Friends fetch error:', err); }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/msg/conversations/list');
      if (res.data.Status) {
        setConversations(res.data.Result || []);
        const total = (res.data.Result || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
        setMsgUnreadCount(total);
      }
    } catch (err) { console.error('Conversations fetch error:', err); }
  }, []);

  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/msg/conversations/${convId}/messages`);
      if (res.data.Status) {
        setMessages(res.data.Result || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (err) { console.error('Messages fetch error:', err); }
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') {
      fetchFriends();
      fetchConversations();
      pollRef.current = setInterval(() => {
        fetchConversations();
        if (activeConversation) fetchMessages(activeConversation.id);
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, activeConversation, fetchConversations, fetchMessages, fetchFriends]);

  const openConversation = async (conv) => {
    setActiveConversation(conv);
    await fetchMessages(conv.id);
    fetchConversations();
  };

  const openFriendChat = async (friendId) => {
    try {
      const res = await api.post('/msg/conversations/student', { friendId });
      if (res.data.Status) {
        await fetchConversations();
        const allConvs = await api.get('/msg/conversations/list');
        const conv = (allConvs.data.Result || []).find(c => c.id === res.data.ConversationId);
        if (conv) { setFriendsSubTab('chats'); openConversation(conv); }
      }
    } catch (err) { console.error('Open friend chat error:', err); }
  };

  const openAdminChat = async () => {
    try {
      const res = await api.post('/msg/conversations/admin');
      if (res.data.Status) {
        await fetchConversations();
        const allConvs = await api.get('/msg/conversations/list');
        const conv = (allConvs.data.Result || []).find(c => c.id === res.data.ConversationId);
        if (conv) { setFriendsSubTab('chats'); openConversation(conv); }
      }
    } catch (err) { console.error('Open admin chat error:', err); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation || sendingMessage) return;
    setSendingMessage(true);
    try {
      await api.post(`/msg/conversations/${activeConversation.id}/messages`, { content: messageInput.trim() });
      setMessageInput('');
      await fetchMessages(activeConversation.id);
      fetchConversations();
    } catch (err) { console.error('Send message error:', err); }
    finally { setSendingMessage(false); }
  };

  const searchFriends = async (q) => {
    setFriendSearchQuery(q);
    if (q.length < 2) { setFriendSearchResults([]); return; }
    try {
      const res = await api.get(`/msg/friends/search?q=${encodeURIComponent(q)}`);
      if (res.data.Status) setFriendSearchResults(res.data.Result || []);
    } catch (err) { console.error('Friend search error:', err); }
  };

  const sendFriendRequest = async (addresseeId) => {
    try {
      await api.post('/msg/friends/request', { addresseeId });
      setFriendSearchResults(prev => prev.filter(s => s.id !== addresseeId));
      fetchFriends();
    } catch (err) { alert(err.response?.data?.Error || 'Could not send request'); }
  };

  const acceptFriend = async (friendshipId) => {
    try {
      await api.post(`/msg/friends/accept/${friendshipId}`);
      fetchFriends();
    } catch (err) { console.error('Accept error:', err); }
  };

  const removeFriend = async (friendshipId) => {
    if (!window.confirm("Remove this friend?")) return;
    try {
      await api.delete(`/msg/friends/${friendshipId}`);
      fetchFriends();
      fetchConversations();
      if (activeConversation) setActiveConversation(null);
    } catch (err) { console.error('Remove friend error:', err); }
  };

  // ─────────────────────────────────────────────────────
  // Quote rotation & timer
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setQuoteIndex(prev => (prev + 1) % quotes.length); setFade(true); }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, [quotes]);

  useEffect(() => {
    let interval;
    if (activeSession && sessionStartTime) {
      interval = setInterval(() => {
        setTimerSeconds(Math.floor((Date.now() - new Date(sessionStartTime).getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession, sessionStartTime]);

  // ─────────────────────────────────────────────────────
  // Trophies
  // Updated for new single-row achievements DB design.
  // achData = { keys_earned: [], progress_map: {} }
  //   keys_earned — array of badge IDs the student has earned
  //   progress_map — { badgeId: progressNumber }
  // The "consistent" badge (7-day streak) is not stored in the
  // DB achievements table — it's derived from currentStreak.
  // ─────────────────────────────────────────────────────
  const calculateTrophies = (achData, currentStreak) => {
    const keys = Array.isArray(achData.keys_earned)
      ? achData.keys_earned
      : (typeof achData.keys_earned === 'string' && achData.keys_earned
        ? achData.keys_earned.split(',').filter(Boolean)
        : []);
    const prog = achData.progress_map || {};

    setTrophies([
      { id: 'first_session', name: 'FIRST STEPS', description: 'Complete your first study session', icon: '🎯', earned: keys.includes('first_session'), earnedAt: null, progress: prog.first_session ?? 0, target: 1 },
      { id: 'early_bird', name: 'EARLY BIRD', description: 'Study before 8 AM', icon: '🌅', earned: keys.includes('early_bird'), earnedAt: null, progress: prog.early_bird ?? 0, target: 1 },
      { id: 'century', name: 'CENTURY', description: 'Study for 100 hours total', icon: '💯', earned: keys.includes('century'), earnedAt: null, progress: prog.century ?? 0, target: 100 },
      { id: 'consistent', name: 'CONSISTENT', description: 'Maintain a 7-day streak', icon: '🔥', earned: currentStreak >= 7, earnedAt: null, progress: currentStreak, target: 7 },
      { id: 'master', name: 'MASTER SCHOLAR', description: 'Complete 50 sessions', icon: '👑', earned: keys.includes('master'), earnedAt: null, progress: prog.master ?? 0, target: 50 },
      { id: 'night_owl', name: 'NIGHT OWL', description: 'Study after 10 PM', icon: '🦉', earned: keys.includes('night_owl'), earnedAt: null, progress: prog.night_owl ?? 0, target: 1 },
    ]);
  };

  // ─────────────────────────────────────────────────────
  // Course handlers
  // ─────────────────────────────────────────────────────
  const handleSaveCourse = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { courseCode: currentCourse.code, courseName: currentCourse.name, color: currentCourse.color };
      editingId ? await api.put(`/courses/update/${editingId}`, payload) : await api.post('/courses/add', payload);
      await fetchDashboardData(); setIsModalOpen(false); resetCourseForm();
    } catch (err) { setError(err.response?.data?.Error || 'Failed to save course'); }
    finally { setLoading(false); }
  };
  const deleteCourse = async (id) => {
    if (!window.confirm("Delete this course?")) return;
    try { await api.delete(`/courses/delete/${id}`); await fetchDashboardData(); }
    catch (err) { setError('Failed to delete course'); }
  };
  const openEditModal = (course) => { setEditingId(course.id); setCurrentCourse({ code: course.course_code, name: course.course_name, color: course.color || '#FFD700' }); setIsModalOpen(true); };
  const resetCourseForm = () => { setCurrentCourse({ code: '', name: '', color: '#FFD700' }); setEditingId(null); setError(null); };

  // Revision handlers
  const handleSaveRevision = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      editingId ? await api.put(`/revisions/update/${editingId}`, { ...currentRevision }) : await api.post('/revisions/add', { ...currentRevision });
      await fetchDashboardData(); setIsRevisionModalOpen(false); resetRevisionForm();
    } catch (err) { setError(err.response?.data?.Error || 'Failed to save revision'); }
    finally { setLoading(false); }
  };
  const completeRevision = async (id) => { try { await api.post(`/revisions/complete/${id}`); await fetchDashboardData(); } catch (err) { setError('Failed'); } };
  const deleteRevision = async (id) => { if (!window.confirm("Delete?")) return; try { await api.delete(`/revisions/delete/${id}`); await fetchDashboardData(); } catch (err) { setError('Failed'); } };
  const resetRevisionForm = () => { setCurrentRevision({ courseId: '', title: '', scheduledDate: format(new Date(), 'yyyy-MM-dd'), duration: 60, priority: 'medium' }); setEditingId(null); setError(null); };

  // Material handlers
  const handleSaveMaterial = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('courseId', currentMaterial.courseId);
      formData.append('title', currentMaterial.title);
      formData.append('type', currentMaterial.type);
      formData.append('description', currentMaterial.description);
      if (currentMaterial.file) formData.append('file', currentMaterial.file);
      else if (currentMaterial.url) formData.append('url', currentMaterial.url);
      editingId
        ? await api.put(`/materials/update/${editingId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post('/materials/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchDashboardData(); setIsMaterialModalOpen(false); resetMaterialForm();
    } catch (err) { setError(err.response?.data?.Error || 'Failed to save material'); }
    finally { setLoading(false); }
  };
  const deleteMaterial = async (id) => { if (!window.confirm("Delete?")) return; try { await api.delete(`/materials/delete/${id}`); await fetchDashboardData(); } catch (err) { setError('Failed'); } };
  const openEditMaterialModal = (m) => { setEditingId(m.id); setCurrentMaterial({ courseId: m.course_id || '', title: m.title, type: m.type, url: m.url || '', description: m.description || '', file: null }); setIsMaterialModalOpen(true); };
  const resetMaterialForm = () => { setCurrentMaterial({ courseId: '', title: '', type: 'pdf', url: '', description: '', file: null }); setEditingId(null); setError(null); };
  const getMaterialIcon = (type) => ({ pdf: '📄', link: '🔗', note: '📝', video: '🎥', image: '🖼️' }[type] || '📎');

  // Notification handlers
  const markNotificationRead = async (id) => { try { await api.post(`/notifications/mark-read/${id}`); await fetchDashboardData(); } catch (err) { console.error(err); } };
  const markAllNotificationsRead = async () => { try { await api.post('/notifications/mark-all-read'); await fetchDashboardData(); } catch (err) { console.error(err); } };
  const deleteNotification = async (id) => { try { await api.delete(`/notifications/delete/${id}`); await fetchDashboardData(); } catch (err) { console.error(err); } };

  // Goal handlers
  const openGoalEdit = () => {
    const current = todayStats.targetMinutes || 120;
    setGoalInputHours(String(Math.floor(current / 60)));
    setGoalInputMins(String(current % 60));
    setIsEditingGoal(true);
  };
  const saveGoal = async () => {
    const h = parseInt(goalInputHours) || 0;
    const m = parseInt(goalInputMins) || 0;
    const total = h * 60 + m;
    if (total < 1 || total > 1440) return;
    try {
      await api.put('/goals/target', { targetMinutes: total });
      setIsEditingGoal(false);
      await fetchDashboardData();
    } catch (err) { console.error('Goal save error:', err); }
  };

  // Session handlers
  const startSession = async () => {
    try {
      const res = await api.post('/sessions/start', { courseId: selectedCourseForSession || null });
      if (res.data.Status) { setActiveSession(res.data.SessionId); setSessionStartTime(res.data.StartTime); setTimerSeconds(0); }
    } catch (err) { setError('Failed to start session'); }
  };
  const endSession = async () => {
    if (!activeSession) return;
    try { await api.post(`/sessions/end/${activeSession}`, { notes: '' }); setActiveSession(null); setSessionStartTime(null); setTimerSeconds(0); setSelectedCourseForSession(''); await fetchDashboardData(); }
    catch (err) { setError('Failed to end session'); }
  };
  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Analytics helpers
  const getWeeklyData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const daySessions = sessionHistory.filter(s => isSameDay(parseISO(s.start_time), date));
      data.push({ day: format(date, 'EEE'), minutes: daySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0), sessions: daySessions.length });
    }
    return data;
  };
  const getCourseDistribution = () => {
    const d = {};
    sessionHistory.forEach(s => { const c = s.course_code || 'General'; d[c] = (d[c] || 0) + (s.duration_minutes || 0); });
    return Object.entries(d).map(([name, value]) => ({ name, value }));
  };
  const getHourlyPattern = () => {
    const hours = Array(24).fill(0);
    sessionHistory.forEach(s => { hours[new Date(s.start_time).getHours()] += s.duration_minutes || 0; });
    return hours.map((minutes, hour) => ({ hour: `${hour}:00`, minutes }));
  };
  const getDaysInMonth = useCallback(() => {
    const today = new Date();
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const days = [];
    let currentDate = startDate;

    for (let i = 0; i < 42; i++) {   // 6 weeks = safer
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      days.push({
        date: currentDate,
        dateStr,
        dayNum: format(currentDate, 'd'),
        isToday: isSameDay(currentDate, today),
        isCurrentMonth: currentDate.getMonth() === currentMonth.getMonth(),
        events: calendarEvents.filter(e => e.date === dateStr),
      });
      currentDate = addDays(currentDate, 1);
    }
    return days;
  }, [currentMonth, calendarEvents]);

  // Settings handlers
  const handleSettingsChange = (e) => setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });

  // Load current profile values (including optional fields) when settings tab opens
  const loadProfileData = useCallback(async () => {
    try {
      const res = await api.get('/students/profile');
      if (res.data.Status) {
        const s = res.data.Result;
        setSettingsForm(prev => ({
          ...prev,
          name: s.name || '',
          email: s.email || '',
          roll_number: s.roll_number || '',
          class_grade: s.class_grade || '',
          section: s.section || '',
          phone: s.phone || '',
        }));
      }
    } catch (err) { /* silently ignore — fields just stay blank */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') loadProfileData();
  }, [activeTab, loadProfileData]);

  const handleSettingsSubmit = async (e) => {
    e.preventDefault(); setSettingsMessage(null); setSettingsError(null); setSettingsLoading(true);
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) { setSettingsError("Passwords don't match"); setSettingsLoading(false); return; }
    try {
      const res = await api.put('/students/profile', {
        name: settingsForm.name,
        email: settingsForm.email,
        roll_number: settingsForm.roll_number || null,
        class_grade: settingsForm.class_grade || null,
        section: settingsForm.section || null,
        phone: settingsForm.phone || null,
        currentPassword: settingsForm.currentPassword || undefined,
        newPassword: settingsForm.newPassword || undefined,
      });
      if (res.data.Status) {
        updateUser({ name: settingsForm.name, email: settingsForm.email });
        setSettingsMessage("Profile updated successfully");
        setSettingsForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) { setSettingsError(err.response?.data?.Error || "Failed to update profile"); }
    finally { setSettingsLoading(false); }
  };
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure? This is permanent.")) return;
    try { await api.delete('/students/account'); logout(); navigate('/logout'); }
    catch (err) { setSettingsError("Failed to delete account"); }
  };

  // ─────────────────────────────────────────────────────
  // RENDER: Dashboard home
  // ─────────────────────────────────────────────────────
  const renderDashboard = () => (
    <>
      <header className="main-header">
        <div className="header-left">
          <h1>WELCOME BACK, {user?.name?.toUpperCase()}</h1>
          <p>{format(new Date(), 'EEEE, MMMM dd').toUpperCase()}</p>
        </div>
        <div className="header-actions">
          <button className={`notif-btn ${unreadCount > 0 ? 'has-unread' : ''}`} onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
            🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
        </div>
      </header>

      {isNotificationsOpen && (
        <div className="notif-panel">
          <div className="notif-header">
            <h4>NOTIFICATIONS</h4>
            <div className="notif-actions">
              {unreadCount > 0 && <button className="btn-text" onClick={markAllNotificationsRead}>Mark all read</button>}
              <button className="btn-text" onClick={() => setIsNotificationsOpen(false)}>✕</button>
            </div>
          </div>
          {notifications.length === 0 ? <p className="notif-empty">No notifications</p> : notifications.map(n => (
            <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
              <div className="notif-content" onClick={() => markNotificationRead(n.id)}>
                <span className="notif-title">{n.title}</span>
                <span className="notif-msg">{n.message}</span>
              </div>
              <button className="btn-icon small" onClick={() => deleteNotification(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <section className="stat-grid">
        <div className="stat-card">
          <span className="card-label">TODAY</span>
          <div className="stat-value">{todayStats.formattedTime}</div>
          <div className="progress-bar"><div className="progress-fill gold" style={{ width: `${todayStats.percentage}%` }}></div></div>
          {isEditingGoal ? (
            <div className="goal-editor">
              <div className="goal-editor-inputs">
                <input
                  type="number" min="0" max="23"
                  className="goal-time-input"
                  value={goalInputHours}
                  onChange={e => setGoalInputHours(e.target.value)}
                  placeholder="0"
                />
                <span className="goal-time-sep">h</span>
                <input
                  type="number" min="0" max="59"
                  className="goal-time-input"
                  value={goalInputMins}
                  onChange={e => setGoalInputMins(e.target.value)}
                  placeholder="0"
                />
                <span className="goal-time-sep">m</span>
              </div>
              <div className="goal-editor-btns">
                <button className="btn-gold small" onClick={saveGoal}>SAVE</button>
                <button className="btn-outline small" onClick={() => setIsEditingGoal(false)}>CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="goal-sub-row">
              <span className="stat-sub">{todayStats.percentage}% of {Math.floor(todayStats.targetMinutes / 60)}h {todayStats.targetMinutes % 60}m goal</span>
              <button className="goal-edit-btn" onClick={openGoalEdit} title="Change daily goal">✎</button>
            </div>
          )}
        </div>
        <div className="stat-card">
          <span className="card-label">STREAK</span>
          <div className="stat-value">{streakData.currentStreak}d</div>
          <div className="streak-dots">
            {streakData.weekData.map((day, i) => (
              <div
                key={i}
                className={`streak-dot ${day.hit ? 'hit' : ''}`}
                title={day.day}
              >
                {/* Render the first 3 letters of the day name in uppercase */}
                {day.day.substring(0, 3).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card">
          <span className="card-label">COURSES</span>
          <div className="stat-value">{courses.length}</div>
          <span className="stat-sub">Active subjects</span>
        </div>
        <div className="stat-card">
          <span className="card-label">TROPHIES</span>
          <div className="stat-value">{trophies.filter(t => t.earned).length}</div>
          <span className="stat-sub">of {trophies.length} earned</span>
          <div className="mini-chart">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={getWeeklyData()}><Area type="monotone" dataKey="minutes" stroke="#FFD700" fill="#FFD700" fillOpacity={0.3} /></AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="lower-grid">
        <div className="content-box hover-glow">
          <h3>ACTIVE COURSES</h3>
          {courses.length > 0 ? (
            <div className="course-list">
              {courses.slice(0, 4).map(course => (
                <div key={course.id} className="course-item interactive" onClick={() => setActiveTab('courses')}>
                  <span className="course-code" style={{ color: course.color }}>{course.course_code}</span>
                  <span className="course-name">{course.course_name}</span>
                  <div className="course-bar" style={{ width: `${Math.random() * 40 + 60}%`, background: course.color }}></div>
                </div>
              ))}
              {courses.length > 4 && <button className="btn-text" onClick={() => setActiveTab('courses')}>+{courses.length - 4} more →</button>}
            </div>
          ) : (
            <div className="empty-state"><div className="ghost-icon">📚</div><p>NO COURSES YET</p><button className="btn-outline" onClick={() => setActiveTab('courses')}>ADD COURSE +</button></div>
          )}
        </div>
        <div className="content-box hover-glow">
          <h3>UPCOMING REVISIONS</h3>
          {revisionSessions.filter(r => r.status !== 'completed').length > 0 ? (
            <div className="revision-list">
              {revisionSessions.filter(r => r.status !== 'completed').slice(0, 3).map(revision => {
                const course = courses.find(c => c.id === revision.course_id);
                return (
                  <div key={revision.id} className="revision-item">
                    <div className="revision-date"><span className="day">{format(parseISO(revision.scheduled_date), 'dd')}</span><span className="month">{format(parseISO(revision.scheduled_date), 'MMM')}</span></div>
                    <div className="revision-info"><span className="revision-title">{revision.title}</span><span className="revision-course" style={{ color: course?.color }}>{course?.course_code || 'General'}</span></div>
                    <span className={`priority-badge ${revision.priority}`}>{revision.priority}</span>
                  </div>
                );
              })}
              <button className="btn-text" onClick={() => setActiveTab('calendar')}>View Calendar →</button>
            </div>
          ) : (
            <div className="empty-state"><div className="ghost-icon">📅</div><p>NO REVISIONS PLANNED</p><button className="btn-outline" onClick={() => setActiveTab('calendar')}>SCHEDULE ONE +</button></div>
          )}
        </div>
      </div>

      <div className="content-box full-width">
        <h3>WEEKLY ACTIVITY</h3>
        <div className="chart-container" style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getWeeklyData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#666" /><YAxis stroke="#666" />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} itemStyle={{ color: '#FFD700' }} />
              <Bar dataKey="minutes" fill="#FFD700" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="content-box full-width">
        <h3>RECENT MATERIALS</h3>
        {materials.length > 0 ? (
          <div className="materials-grid">
            {materials.slice(0, 4).map(material => {
              const course = courses.find(c => c.id === material.course_id);
              return (
                <div key={material.id} className="material-card">
                  <span className="material-icon">{getMaterialIcon(material.type)}</span>
                  <div className="material-info"><span className="material-title">{material.title}</span><span className="material-course" style={{ color: course?.color }}>{course?.course_code || 'General'}</span></div>
                  <a href={material.url} target="_blank" rel="noopener noreferrer" className="btn-icon">↗️</a>
                </div>
              );
            })}
            {materials.length > 4 && <button className="btn-text" onClick={() => setActiveTab('courses')}>+{materials.length - 4} more →</button>}
          </div>
        ) : <div className="empty-state"><p>NO MATERIALS UPLOADED</p></div>}
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Sessions
  // ─────────────────────────────────────────────────────
  const renderSessions = () => (
    <>
      <header className="main-header"><div className="header-left"><h1>SESSIONS</h1><p>LIVE TRACKING & HISTORY</p></div></header>
      <div className="session-layout">
        <div className="timer-section">
          <div className={`stat-card large timer-card ${activeSession ? 'active' : ''}`}>
            <span className="card-label">{activeSession ? 'SESSION IN PROGRESS' : 'READY TO START'}</span>
            <div className="timer-display">{formatTimer(timerSeconds)}</div>
            {!activeSession && (
              <div className="course-selector">
                <select value={selectedCourseForSession} onChange={e => setSelectedCourseForSession(e.target.value)} className="course-select">
                  <option value="">Select Course (Optional)</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>)}
                </select>
              </div>
            )}
            {activeSession ? <button className="btn-gold stop" onClick={endSession}>END SESSION</button> : <button className="btn-gold start" onClick={startSession}>START SESSION</button>}
            {activeSession && <p className="session-meta">Session #{activeSession} • Started {new Date(sessionStartTime).toLocaleTimeString()}</p>}
          </div>
        </div>
        <div className="history-section">
          <div className="content-box">
            <h3>RECENT SESSIONS</h3>
            {sessionHistory.length > 0 ? (
              <div className="session-list">
                {sessionHistory.slice(0, 10).map(session => {
                  const course = courses.find(c => c.id === session.course_id);
                  return (
                    <div key={session.id} className="session-row">
                      <div className="session-info"><span className="session-course" style={{ color: course?.color || '#FFD700' }}>{course?.course_code || 'GENERAL'}</span><span className="session-time">{format(parseISO(session.start_time), 'MMM dd, HH:mm')}</span></div>
                      <div className="session-duration">{session.duration_minutes}m</div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="empty-state"><p>NO SESSIONS YET</p></div>}
          </div>
        </div>
      </div>
      <div className="content-box full-width">
        <h3>STUDY PATTERNS (LAST 7 DAYS)</h3>
        <div className="chart-container" style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getWeeklyData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="day" stroke="#666" /><YAxis yAxisId="left" stroke="#666" /><YAxis yAxisId="right" orientation="right" stroke="#666" />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} /><Legend />
              <Line yAxisId="left" type="monotone" dataKey="minutes" stroke="#FFD700" strokeWidth={2} name="Minutes" />
              <Line yAxisId="right" type="monotone" dataKey="sessions" stroke="#4ECDC4" strokeWidth={2} name="Sessions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Courses
  // ─────────────────────────────────────────────────────
  const renderCourses = () => (
    <>
      <header className="main-header">
        <div className="header-left"><h1>COURSES</h1><p>MANAGE SUBJECTS & MATERIALS</p></div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => { resetMaterialForm(); setIsMaterialModalOpen(true); }}>ADD MATERIAL +</button>
          <button className="btn-gold" onClick={() => { resetCourseForm(); setIsModalOpen(true); }}>NEW SUBJECT +</button>
        </div>
      </header>
      <div className="courses-grid">
        {loading ? <div className="empty-state"><div className="spinner"></div><p>LOADING...</p></div>
          : courses.length > 0 ? courses.map(course => {
            const courseSessions = sessionHistory.filter(s => s.course_id === course.id);
            const totalMinutes = courseSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
            const courseMaterials = materials.filter(m => m.course_id === course.id);
            return (
              <div key={course.id} className="course-card" style={{ borderLeftColor: course.color }}>
                <div className="course-header">
                  <h3 style={{ color: course.color }}>{course.course_code}</h3>
                  <div className="course-actions">
                    <button className="btn-icon" onClick={() => openEditModal(course)}>✏️</button>
                    <button className="btn-icon delete" onClick={() => deleteCourse(course.id)}>🗑️</button>
                  </div>
                </div>
                <p className="course-fullname">{course.course_name}</p>
                <div className="course-stats">
                  <div className="stat"><span className="stat-num">{courseSessions.length}</span><span className="stat-label">Sessions</span></div>
                  <div className="stat"><span className="stat-num">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span><span className="stat-label">Total Time</span></div>
                  <div className="stat"><span className="stat-num">{courseMaterials.length}</span><span className="stat-label">Materials</span></div>
                </div>
                {courseMaterials.length > 0 && (
                  <div className="course-materials">
                    <h4>Materials ({courseMaterials.length})</h4>
                    {courseMaterials.map(m => (
                      <div key={m.id} className="material-mini">
                        <span>{getMaterialIcon(m.type)}</span>
                        <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a>
                        <button className="btn-icon small" onClick={() => openEditMaterialModal(m)}>✏️</button>
                        <button className="btn-icon small delete" onClick={() => deleteMaterial(m.id)}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="progress-ring">
                  <svg viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#333" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={course.color} strokeWidth="3" strokeDasharray={`${Math.min(100, (totalMinutes / 600) * 100)}, 100`} />
                  </svg>
                </div>
              </div>
            );
          }) : <div className="empty-state large"><div className="ghost-icon large">📚</div><p>NO COURSES YET</p><button className="btn-outline" onClick={() => setIsModalOpen(true)}>ADD YOUR FIRST COURSE</button></div>
        }
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-content">
            <h3>{editingId ? "EDIT COURSE" : "ADD COURSE"}</h3>
            {error && <div className="error-text">{error}</div>}
            <form onSubmit={handleSaveCourse}>
              <input type="text" placeholder="Course Code (e.g., CS101)" value={currentCourse.code} onChange={e => setCurrentCourse({ ...currentCourse, code: e.target.value.toUpperCase() })} required maxLength="20" />
              <input type="text" placeholder="Course Name" value={currentCourse.name} onChange={e => setCurrentCourse({ ...currentCourse, name: e.target.value })} required maxLength="100" />
              <div className="color-picker"><label>Color:</label><input type="color" value={currentCourse.color} onChange={e => setCurrentCourse({ ...currentCourse, color: e.target.value })} /></div>
              <div className="modal-btns">
                <button type="button" className="btn-outline" onClick={() => setIsModalOpen(false)} disabled={loading}>CANCEL</button>
                <button type="submit" className="btn-gold" disabled={loading}>{loading ? 'SAVING...' : 'SAVE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMaterialModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsMaterialModalOpen(false); }}>
          <div className="modal-content">
            <h3>{editingId ? "EDIT MATERIAL" : "ADD MATERIAL"}</h3>
            {error && <div className="error-text">{error}</div>}
            <form onSubmit={handleSaveMaterial}>
              <select value={currentMaterial.courseId} onChange={e => setCurrentMaterial({ ...currentMaterial, courseId: e.target.value })}>
                <option value="">No Course (General)</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>)}
              </select>
              <input type="text" placeholder="Title" value={currentMaterial.title} onChange={e => setCurrentMaterial({ ...currentMaterial, title: e.target.value })} required />
              <select value={currentMaterial.type} onChange={e => setCurrentMaterial({ ...currentMaterial, type: e.target.value })}>
                <option value="pdf">PDF</option><option value="link">Link</option><option value="note">Note</option><option value="video">Video</option><option value="image">Image</option>
              </select>
              {currentMaterial.type === 'link' ? <input type="url" placeholder="URL" value={currentMaterial.url} onChange={e => setCurrentMaterial({ ...currentMaterial, url: e.target.value })} /> : <input type="file" onChange={e => setCurrentMaterial({ ...currentMaterial, file: e.target.files[0] })} />}
              <textarea placeholder="Description (optional)" value={currentMaterial.description} onChange={e => setCurrentMaterial({ ...currentMaterial, description: e.target.value })} rows="2" />
              <div className="modal-btns">
                <button type="button" className="btn-outline" onClick={() => setIsMaterialModalOpen(false)} disabled={loading}>CANCEL</button>
                <button type="submit" className="btn-gold" disabled={loading}>{loading ? 'SAVING...' : 'SAVE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Calendar
  // ─────────────────────────────────────────────────────
  const renderCalendar = () => (
    <>
      <header className="main-header">
        <div className="header-left"><h1>CALENDAR</h1><p>REVISION SCHEDULE • {format(currentMonth, 'MMMM yyyy').toUpperCase()}</p></div>
        <div className="header-actions">
          <button
            className="btn-outline"
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          >
            ← Prev
          </button>
          <button
            className="btn-outline"
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          >
            Next →
          </button>
          <button
            className="btn-gold"
            onClick={() => { resetRevisionForm(); setIsRevisionModalOpen(true); }}
          >
            + ADD REVISION
          </button>
        </div>
      </header>
      <div className="calendar-container">
        <div className="calendar-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="cal-header-day">{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {getDaysInMonth().map((day, index) => (
            <div
              key={index}
              className={`
    cal-day
    ${day.isToday ? 'today' : ''}
    ${!day.isCurrentMonth ? 'other-month' : ''}
    ${day.events.length > 0 ? 'has-events' : ''}
  `}
            >
              <div className="day-number">{day.dayNum}</div>

              <div className="cal-events-container">
                {day.events.slice(0, 3).map(ev => {
                  // Logic to check if it's missed: not completed and date is before today
                  const isMissed = !ev.completed && new Date(ev.date) < new Date().setHours(0, 0, 0, 0);

                  return (
                    <div
                      key={ev.id}
                      className={`cal-event ${ev.completed ? 'completed' : ''} ${isMissed ? 'missed' : ''}`}
                      style={{
                        borderLeft: `3px solid ${isMissed ? '#ff4d4d' : ev.color}`,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find the full revision object to populate the modal
                        const revision = revisionSessions.find(r => r.id === ev.id);
                        if (revision) {
                          setEditingId(revision.id);
                          setCurrentRevision({
                            courseId: revision.course_id || '',
                            title: revision.title,
                            scheduledDate: format(parseISO(revision.scheduled_date), 'yyyy-MM-dd'),
                            duration: revision.duration_minutes,
                            priority: revision.priority
                          });
                          setIsRevisionModalOpen(true);
                        }
                      }}
                    >
                      <div className="ev-info">
                        <span className="ev-title">{ev.title}</span>
                        {ev.completed ? (
                          <span className="status-tag done">✓ DONE</span>
                        ) : isMissed ? (
                          <span className="status-tag missed">! MISSED</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {day.events.length > 3 && (
                  <div className="cal-event more">+{day.events.length - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {isRevisionModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsRevisionModalOpen(false); }}>
          <div className="modal-content">
            <h3>{editingId ? "REVISION DETAILS" : "ADD REVISION"}</h3>
            {error && <div className="error-text">{error}</div>}


            {editingId && (
              <div className="current-status-box" style={{ marginBottom: '1.5rem', padding: '12px', background: '#222', borderRadius: '8px' }}>
                <strong>Status:</strong>{' '}
                {revisionSessions.find(r => r.id === editingId)?.status === 'completed' ? (
                  <span style={{ color: '#4caf50', fontWeight: 'bold' }}>COMPLETED ✓</span>
                ) : new Date(revisionSessions.find(r => r.id === editingId)?.scheduled_date) < new Date().setHours(0, 0, 0, 0) ? (
                  <span style={{ color: '#f44336', fontWeight: 'bold' }}>MISSED !</span>
                ) : (
                  <span style={{ color: '#ff9800' }}>PENDING</span>
                )}
              </div>
            )}


            <form onSubmit={handleSaveRevision}>
              <div className="form-group">
                <label>Course</label>
                <select
                  value={currentRevision.courseId}
                  onChange={e => setCurrentRevision({ ...currentRevision, courseId: e.target.value })}
                  className="course-select"
                >
                  <option value="">General (No Course)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.course_code} – {c.course_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={currentRevision.title}
                  onChange={e => setCurrentRevision({ ...currentRevision, title: e.target.value })}
                  placeholder="e.g. Chapter 3 Review"
                  required
                />
              </div>
              <div className="form-group">
                <label>Scheduled Date *</label>
                <input
                  type="date"
                  value={currentRevision.scheduledDate}
                  onChange={e => setCurrentRevision({ ...currentRevision, scheduledDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  value={currentRevision.duration}
                  onChange={e => setCurrentRevision({ ...currentRevision, duration: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={currentRevision.priority}
                  onChange={e => setCurrentRevision({ ...currentRevision, priority: e.target.value })}
                className="priority-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Add Mark Complete button only when editing & not yet completed */}
              {editingId && revisionSessions.find(r => r.id === editingId)?.status !== 'completed' && (
                <div style={{ margin: '1.5rem 0', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-gold"
                    onClick={async () => {
                      if (!window.confirm("Mark this revision as completed?")) return;
                      await completeRevision(editingId);
                      setIsRevisionModalOpen(false);
                    }}
                    style={{ minWidth: '180px' }}
                  >
                    ✓ MARK AS COMPLETED
                  </button>
                </div>
              )}

              <div className="modal-btns">
                <button type="button" className="btn-outline" onClick={() => setIsRevisionModalOpen(false)} disabled={loading}>
                  CANCEL
                </button>
                <button type="submit" className="btn-gold" disabled={loading}>
                  {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>

            {/* Optional: separate delete button */}
            {editingId && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn-outline delete"
                  onClick={() => {
                    if (window.confirm("Delete this revision?")) {
                      deleteRevision(editingId);
                      setIsRevisionModalOpen(false);
                    }
                  }}
                >
                  Delete Revision
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Trophies
  // ─────────────────────────────────────────────────────
  const renderTrophies = () => (
    <>
      <header className="main-header"><div className="header-left"><h1>TROPHIES</h1><p>ACHIEVEMENTS & MILESTONES</p></div></header>
      <div className="trophies-grid">
        {trophies.map(trophy => (
          <div key={trophy.id} className={`trophy-card ${trophy.earned ? 'earned' : 'locked'}`}>
            <div className="trophy-icon">{trophy.icon}</div>
            <h3>{trophy.name}</h3>
            <p>{trophy.description}</p>
            {trophy.earned ? (
              <div className="trophy-status earned"><span className="badge">EARNED</span>{trophy.earnedAt && <span className="date">{format(parseISO(trophy.earnedAt), 'MMM dd, yyyy')}</span>}</div>
            ) : (
              <div className="trophy-progress">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, (trophy.progress / trophy.target) * 100)}%` }}></div></div>
                <span className="progress-text">{trophy.progress} / {trophy.target}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="content-box stats-summary">
        <h3>ACHIEVEMENT STATS</h3>
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-value">{trophies.filter(t => t.earned).length}</span><span className="summary-label">Earned</span></div>
          <div className="summary-item"><span className="summary-value">{trophies.filter(t => !t.earned).length}</span><span className="summary-label">In Progress</span></div>
          <div className="summary-item"><span className="summary-value">{trophies.length > 0 ? Math.round((trophies.filter(t => t.earned).length / trophies.length) * 100) : 0}%</span><span className="summary-label">Completion</span></div>
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Data Room
  // ─────────────────────────────────────────────────────
  const renderDataRoom = () => (
    <>
      <header className="main-header"><div className="header-left"><h1>DATA ROOM</h1><p>ANALYTICS & INSIGHTS</p></div></header>
      {analyticsData && sessionHistory.length > 0 ? (
        <div className="analytics-dashboard">
          <div className="stat-grid analytics-summary">
            <div className="stat-card"><span className="card-label">TOTAL STUDY TIME</span><div className="stat-value">{analyticsData.totalStudyTime}</div></div>
            <div className="stat-card"><span className="card-label">TOTAL SESSIONS</span><div className="stat-value">{analyticsData.totalSessions}</div></div>
            <div className="stat-card"><span className="card-label">THIS MONTH</span><div className="stat-value">{Math.floor(analyticsData.thisMonthMinutes / 60)}h {analyticsData.thisMonthMinutes % 60}m</div></div>
            <div className="stat-card"><span className="card-label">AVG SESSION</span><div className="stat-value">{analyticsData.totalSessions > 0 ? `${Math.round(analyticsData.totalMinutes / analyticsData.totalSessions)}m` : '0m'}</div></div>
          </div>
          <div className="content-box chart-box">
            <h3>WEEKLY ACTIVITY TREND</h3>
            <div className="chart-container" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getWeeklyData()}>
                  <defs><linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FFD700" stopOpacity={0.8} /><stop offset="95%" stopColor="#FFD700" stopOpacity={0.2} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="day" stroke="#888" /><YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ color: '#FFD700' }} />
                  <Area type="monotone" dataKey="minutes" stroke="#FFD700" fillOpacity={1} fill="url(#colorMinutes)" name="Minutes Studied" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lower-grid">
            <div className="content-box chart-box">
              <h3>COURSE DISTRIBUTION</h3>
              <div className="chart-container" style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={getCourseDistribution()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{getCourseDistribution().map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#e1dede', border: '1px solid #ebe7e7' }} /><Legend /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="content-box chart-box">
              <h3>HOURLY STUDY PATTERN</h3>
              <div className="chart-container" style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getHourlyPattern()}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="hour" stroke="#888" interval={2} /><YAxis stroke="#888" /><Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} /><Bar dataKey="minutes" fill="#4ECDC4" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="content-box insights-box">
            <h3>PRODUCTIVITY INSIGHTS</h3>
            <div className="insights-grid">
              <div className="insight-card"><span className="insight-label">Most Productive Day</span><span className="insight-value">{getWeeklyData().reduce((max, day) => day.minutes > max.minutes ? day : max, getWeeklyData()[0])?.day || 'N/A'}</span></div>
              <div className="insight-card"><span className="insight-label">Most Active Course</span><span className="insight-value">{getCourseDistribution().reduce((max, curr) => curr.value > max.value ? curr : max, { name: 'N/A', value: 0 })?.name}</span></div>
              <div className="insight-card"><span className="insight-label">Peak Study Hour</span><span className="insight-value">{getHourlyPattern().reduce((max, h, i) => h.minutes > max.minutes ? { hour: i, minutes: h.minutes } : max, { hour: 0, minutes: 0 })?.hour}:00</span></div>
              <div className="insight-card"><span className="insight-label">Consistency Score</span><span className="insight-value">{Math.min(100, Math.round((streakData.currentStreak / 7) * 100))}%</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="content-box empty-analytics">
          <div className="empty-state large"><div className="ghost-icon large">📊</div><h3>INSUFFICIENT DATA</h3><p>Complete at least 3 study sessions to unlock analytics</p>
            <div className="progress-steps">
              <div className={`step ${sessionHistory.length >= 1 ? 'complete' : ''}`}>1 Session</div>
              <div className={`step ${sessionHistory.length >= 2 ? 'complete' : ''}`}>2 Sessions</div>
              <div className={`step ${sessionHistory.length >= 3 ? 'complete' : ''}`}>3 Sessions</div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Messages
  // ─────────────────────────────────────────────────────
  const pendingRequests = friends.filter(f => f.status === 'pending' && f.addressee_id === user?.id);
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  const renderMessages = () => (
    <>
      <header className="main-header">
        <div className="header-left">
          <h1>MESSAGES</h1>
          <p>FRIENDS & DEVELOPER SUPPORT</p>
        </div>
        <div className="header-actions">
          <button className={`msg-tab-btn ${friendsSubTab === 'chats' ? 'active' : ''}`} onClick={() => setFriendsSubTab('chats')}>CHATS</button>
          <button className={`msg-tab-btn ${friendsSubTab === 'friends' ? 'active' : ''}`} onClick={() => { setFriendsSubTab('friends'); fetchFriends(); }}>
            FRIENDS {pendingRequests.length > 0 && <span className="msg-badge">{pendingRequests.length}</span>}
          </button>
          <button className={`msg-tab-btn ${friendsSubTab === 'search' ? 'active' : ''}`} onClick={() => setFriendsSubTab('search')}>FIND PEOPLE</button>
        </div>
      </header>

      <div className="messages-layout">
        {/* LEFT PANEL */}
        <div className="msg-sidebar">
          {friendsSubTab === 'chats' && (
            <>
              <div className="msg-sidebar-header">
                <span>CONVERSATIONS</span>
                <button className="msg-support-btn" onClick={openAdminChat}>ASK DEVELOPERS</button>
              </div>
              <div className="msg-conv-list">
                {conversations.length === 0 ? (
                  <div className="msg-empty"><p>No conversations yet.</p><p>Add friends to start chatting or tap ASK DEVELOPERS for support.</p></div>
                ) : (
                  conversations.map(conv => (
                    <div key={conv.id} className={`msg-conv-item ${activeConversation?.id === conv.id ? 'active' : ''} ${conv.type === 'student_admin' ? 'support' : ''}`} onClick={() => openConversation(conv)}>
                      <div className="msg-conv-avatar">{conv.type === 'student_admin' ? '🛠' : conv.other_name?.charAt(0).toUpperCase()}</div>
                      <div className="msg-conv-info">
                        <span className="msg-conv-name">{conv.other_name}</span>
                        <span className="msg-conv-last">{conv.last_message || 'No messages yet'}</span>
                      </div>
                      {conv.unread_count > 0 && <span className="msg-unread-dot">{conv.unread_count}</span>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {friendsSubTab === 'friends' && (
            <>
              <div className="msg-sidebar-header"><span>YOUR FRIENDS ({acceptedFriends.length})</span></div>
              {pendingRequests.length > 0 && (
                <div className="msg-requests-section">
                  <p className="msg-section-label">PENDING REQUESTS ({pendingRequests.length})</p>
                  {pendingRequests.map(req => (
                    <div key={req.friendship_id} className="msg-friend-item pending">
                      <div className="msg-friend-avatar">{req.friend_name?.charAt(0).toUpperCase()}</div>
                      <div className="msg-friend-info"><span className="msg-friend-name">{req.friend_name}</span><span className="msg-friend-sub">{req.friend_email}</span></div>
                      <div className="msg-friend-actions">
                        <button className="btn-gold small" onClick={() => acceptFriend(req.friendship_id)}>ACCEPT</button>
                        <button className="btn-text" onClick={() => removeFriend(req.friendship_id)}>DECLINE</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="msg-friends-list">
                {acceptedFriends.length === 0 ? <div className="msg-empty"><p>No friends yet.</p><p>Use Find People to add friends.</p></div>
                  : acceptedFriends.map(f => (
                    <div key={f.friendship_id} className="msg-friend-item">
                      <div className="msg-friend-avatar">{f.friend_name?.charAt(0).toUpperCase()}</div>
                      <div className="msg-friend-info"><span className="msg-friend-name">{f.friend_name}</span><span className="msg-friend-sub">{f.friend_class || f.friend_email}</span></div>
                      <div className="msg-friend-actions">
                        <button className="btn-text" onClick={() => openFriendChat(f.friend_id)}>CHAT</button>
                        <button className="btn-text delete" onClick={() => removeFriend(f.friendship_id)}>REMOVE</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}

          {friendsSubTab === 'search' && (
            <>
              <div className="msg-sidebar-header"><span>FIND PEOPLE</span></div>
              <div className="msg-search-box">
                <input type="text" placeholder="Search by name or email..." value={friendSearchQuery} onChange={e => searchFriends(e.target.value)} className="msg-search-input" />
              </div>
              <div className="msg-search-results">
                {friendSearchQuery.length < 2 ? (
                  <div className="msg-empty"><p>Type at least 2 characters to search.</p></div>
                ) : friendSearchResults.length === 0 ? (
                  <div className="msg-empty"><p>No students found.</p></div>
                ) : (
                  friendSearchResults.map(student => {
                    const alreadyFriend = friends.some(f => f.friend_id === student.id);
                    const pending = friends.some(f => f.friend_id === student.id && f.status === 'pending');
                    return (
                      <div key={student.id} className="msg-friend-item">
                        <div className="msg-friend-avatar">{student.name?.charAt(0).toUpperCase()}</div>
                        <div className="msg-friend-info"><span className="msg-friend-name">{student.name}</span><span className="msg-friend-sub">{student.class_grade || student.email}</span></div>
                        <div className="msg-friend-actions">
                          {alreadyFriend ? <span className="msg-status-tag">{pending ? 'PENDING' : 'FRIEND'}</span>
                            : <button className="btn-gold small" onClick={() => sendFriendRequest(student.id)}>ADD</button>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL — Chat window */}
        <div className="msg-chat-area">
          {!activeConversation ? (
            <div className="msg-chat-placeholder">
              <div className="msg-placeholder-icon">💬</div>
              <h3>SELECT A CONVERSATION</h3>
              <p>Choose a friend from the left to start chatting, or tap ASK DEVELOPERS for support.</p>
            </div>
          ) : (
            <>
              <div className="msg-chat-header">
                <div className="msg-chat-title">
                  <div className="msg-chat-avatar">{activeConversation.type === 'student_admin' ? '🛠' : activeConversation.other_name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <span className="msg-chat-name">{activeConversation.other_name}</span>
                    {activeConversation.type === 'student_admin' && <span className="msg-chat-sub">Developer Support</span>}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setActiveConversation(null)}>✕</button>
              </div>

              <div className="msg-messages-list">
                {messages.length === 0 ? (
                  <div className="msg-empty center">
                    <p>{activeConversation.type === 'student_admin' ? 'Ask the developers anything about the app.' : `Start your conversation with ${activeConversation.other_name}!`}</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_type === 'student' && msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`msg-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}>
                        {!isMine && <span className="msg-sender-name">{msg.sender_name}</span>}
                        <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'}`}>{msg.content}</div>
                        <span className="msg-time">{format(parseISO(msg.created_at), 'HH:mm')}</span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="msg-input-row" onSubmit={sendMessage}>
                <input
                  type="text"
                  className="msg-input"
                  placeholder={activeConversation.type === 'student_admin' ? 'Ask the developers...' : `Message ${activeConversation.other_name}...`}
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  autoComplete="off"
                />
                <button type="submit" className="msg-send-btn" disabled={!messageInput.trim() || sendingMessage}>
                  {sendingMessage ? '...' : '→'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Settings
  // ─────────────────────────────────────────────────────
  const renderSettings = () => (
    <>
      <header className="main-header"><div className="header-left"><h1>SETTINGS</h1><p>ACCOUNT & PREFERENCES • {user?.name?.toUpperCase()}</p></div></header>
      <div className="settings-grid">
        <div className="content-box">
          <h3>PROFILE INFORMATION</h3>
          {settingsMessage && <div className="success-banner">{settingsMessage}</div>}
          {settingsError && <div className="error-banner">{settingsError}</div>}
          <form onSubmit={handleSettingsSubmit} className="settings-form">
            <div className="form-group"><label>Full Name</label><input type="text" name="name" value={settingsForm.name} onChange={handleSettingsChange} required /></div>
            <div className="form-group"><label>Email Address</label><input type="email" name="email" value={settingsForm.email} onChange={handleSettingsChange} required /></div>
            <div className="form-group"><label>Roll Number <span style={{ color: '#888', fontSize: '0.8em' }}>(optional)</span></label><input type="text" name="roll_number" value={settingsForm.roll_number} onChange={handleSettingsChange} placeholder="e.g. 2204064" /></div>
            <div className="form-group"><label>Class / Grade <span style={{ color: '#888', fontSize: '0.8em' }}>(optional)</span></label><input type="text" name="class_grade" value={settingsForm.class_grade} onChange={handleSettingsChange} placeholder="e.g. Level 3" /></div>
            <div className="form-group"><label>Section <span style={{ color: '#888', fontSize: '0.8em' }}>(optional)</span></label><input type="text" name="section" value={settingsForm.section} onChange={handleSettingsChange} placeholder="e.g. A / B " /></div>
            <div className="form-group"><label>Phone <span style={{ color: '#888', fontSize: '0.8em' }}>(optional)</span></label><input type="tel" name="phone" value={settingsForm.phone} onChange={handleSettingsChange} placeholder="e.g. +01707204141" /></div>
            <div className="form-group"><label>Current Password</label><input type="password" name="currentPassword" value={settingsForm.currentPassword} onChange={handleSettingsChange} placeholder="••••••••" /></div>
            <div className="form-group"><label>New Password <span style={{ color: '#888', fontSize: '0.8em' }}>(optional)</span></label><input type="password" name="newPassword" value={settingsForm.newPassword} onChange={handleSettingsChange} placeholder="Leave blank to keep current" /></div>
            <div className="form-group"><label>Confirm New Password</label><input type="password" name="confirmPassword" value={settingsForm.confirmPassword} onChange={handleSettingsChange} placeholder="••••••••" /></div>
            <button type="submit" className="btn-gold" disabled={settingsLoading}>{settingsLoading ? 'SAVING...' : 'SAVE CHANGES'}</button>
          </form>
        </div>
        <div className="content-box danger-zone">
          <h3>DANGER ZONE</h3>
          <p>Once deleted, your account and all data cannot be recovered.</p>
          <button className="btn-danger" onClick={handleDeleteAccount}>DELETE ACCOUNT</button>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'sessions': return renderSessions();
      case 'courses': return renderCourses();
      case 'calendar': return renderCalendar();
      case 'trophies': return renderTrophies();
      case 'data': return renderDataRoom();
      case 'messages': return renderMessages();
      case 'settings': return renderSettings();
      default: return null;
    }
  };

  if (!user) return <div className="loading-screen">Loading...</div>;

  const totalBadge = msgUnreadCount + unreadCount;

  return (
    <div className="dash-container">
      <nav className="dash-nav">
        <div className="nav-brand" onClick={() => setActiveTab('dashboard')}><span className="brand-icon">◈</span> DYNAMISM</div>
        <div className="nav-actions">
          <button className="nav-btn" onClick={() => navigate('/about')}>ABOUT</button>
          <button className="nav-btn" onClick={() => navigate('/faq')}>FAQ</button>
          <div className="profile-pill">
            <div className="p-avatar" style={{ background: COLORS[user.id % COLORS.length] }}>{user.name?.charAt(0).toUpperCase()}</div>
            <span className="p-name">{user.name}</span>
          </div>
        </div>
      </nav>

      <div className="dash-body">
        <aside className="dash-sidebar">
          <ul className="side-links">
            {[
              { id: 'dashboard', icon: '🏠', label: 'DASHBOARD' },
              { id: 'sessions', icon: '⏱', label: 'SESSIONS' },
              { id: 'courses', icon: '📚', label: 'COURSES' },
              { id: 'calendar', icon: '📅', label: 'CALENDAR' },
              { id: 'trophies', icon: '🏆', label: 'TROPHIES' },
              { id: 'messages', icon: '💬', label: 'MESSAGES' },
              { id: 'data', icon: '📊', label: 'DATA ROOM' },
              { id: 'settings', icon: '⚙️', label: 'SETTINGS' },
            ].map(item => (
              <li key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => setActiveTab(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === 'trophies' && trophies.filter(t => t.earned).length > 0 && <span className="badge">{trophies.filter(t => t.earned).length}</span>}
                {item.id === 'messages' && msgUnreadCount > 0 && <span className="badge">{msgUnreadCount}</span>}
              </li>
            ))}
            <li onClick={() => { logout(); navigate('/logout'); }} className="logout-item">
              <span className="nav-icon">⏻</span>
              <span className="nav-label">LOGOUT</span>
            </li>
          </ul>

          <div className="side-quote-box">
            <div className={`quote-content ${fade ? 'fade-in' : 'fade-out'}`}>
              <p className="quote-text">"{quotes[quoteIndex].text}"</p>
              <span className="quote-author">— {quotes[quoteIndex].author}</span>
            </div>
            <div className="quote-accent-bar"></div>
          </div>

          {activeSession && <div className="mini-timer"><span className="pulse"></span>{formatTimer(timerSeconds)}</div>}
        </aside>

        <main className="dash-main">{renderContent()}</main>
      </div>
    </div>
  );
}