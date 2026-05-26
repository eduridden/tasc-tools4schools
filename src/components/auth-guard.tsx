
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/firebase/auth/use-user';
import { Skeleton } from './ui/skeleton';

interface AuthGuardProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
    const { user, isAdmin, isUserLoading } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isUserLoading) {
            if (!user) {
                navigate('/');
            } else if (requireAdmin && !isAdmin) {
                navigate('/');
            }
        }
    }, [user, isAdmin, isUserLoading, navigate, requireAdmin]);

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Skeleton className="h-12 w-12 rounded-full" />
            </div>
        );
    }

    if (!user || (requireAdmin && !isAdmin)) {
        return null;
    }

    return <>{children}</>;
}