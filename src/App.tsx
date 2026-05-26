
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import HomePage from '@/pages/Home';
import ToolPage from '@/pages/Tool';
import AdminPage from '@/pages/Admin';
import AdminToolEditor from '@/pages/AdminToolEditor';
import { AuthGuard } from '@/components/auth-guard';
import { LoginGate } from '@/components/login-gate';
import UserSettingsPage from '@/pages/UserSettings';

function App() {
    return (
        <Router>
            <FirebaseClientProvider>
                <LoginGate>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/tool/:id" element={<ToolPage />} />
                    <Route path="/settings" element={<UserSettingsPage />} />
                    <Route
                        path="/admin"
                        element={
                            <AuthGuard requireAdmin>
                                <AdminPage />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/admin/tools/new"
                        element={
                            <AuthGuard requireAdmin>
                                <AdminToolEditor />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/admin/tools/:id"
                        element={
                            <AuthGuard requireAdmin>
                                <AdminToolEditor />
                            </AuthGuard>
                        }
                    />
                </Routes>
                </LoginGate>
                <Toaster />
            </FirebaseClientProvider>
        </Router>
    );
}

export default App;
