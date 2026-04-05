import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Routes, Route } from 'react-router-dom';
import Login from './Components/Login';
import Dashboard from './Components/Dashboard';
import Logout from './Components/Logout';
import Landing from './Components/Landing';
import Contact from './Components/Contact';
import FAQ from './Components/FAQ';
import AboutUs from './Components/Aboutus';
import AdminDashboard from './Components/AdminDashboard';
import { ProtectedRoute } from './Components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path='/' element={<Landing />} />
      <Route path='/login' element={<Login />} />
      <Route path='/dashboard' element={<Dashboard />} />
      <Route path='/logout' element={<Logout />} />
      <Route path='/contact' element={<Contact />} />
      <Route path='/faq' element={<FAQ />} />
      <Route path='/about' element={<AboutUs />} />
      <Route path='/admin' element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
       
    </Routes>
  );
}

export default App;