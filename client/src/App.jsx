import { Routes, Route, Navigate } from 'react-router-dom';
import GameTable from './components/Game/GameTable';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';
import CardDemo from './components/Game/CardDemo';
import CardDebug from './components/Game/CardDebug';
import HandDemo from './components/Game/HandDemo';
import AdminPage from './components/Admin';

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/card-debug" element={<CardDebug />} />
            <Route path="/hand-demo" element={<HandDemo />} />
            <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/table" replace />} />
                <Route path="/table" element={
                    <PrivateRoute>
                        <GameTable />
                    </PrivateRoute>
                } />
                <Route path="/admin" element={
                    <PrivateRoute>
                        <AdminPage />
                    </PrivateRoute>
                } />
                <Route path="/card-demo" element={<CardDemo />} />
            </Route>
        </Routes>
    );
}

export default App;