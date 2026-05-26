
'use client';

interface StatsCardsProps {
    stats: {
        totalTools: number;
        totalCategories: number;
        freeTools: number;
        recommendedTools: number;
    };
    isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
    if (isLoading) {
        return (
            <div className="stats stats-vertical sm:stats-horizontal w-full shadow">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="stat">
                        <div className="skeleton h-4 w-24 mb-2" />
                        <div className="skeleton h-8 w-16" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="stats stats-vertical sm:stats-horizontal w-full shadow">
            <div className="stat">
                <div className="stat-title">Total AI Tools</div>
                <div className="stat-value text-primary">{stats.totalTools}</div>
            </div>
            <div className="stat">
                <div className="stat-title">Categories</div>
                <div className="stat-value text-info">{stats.totalCategories}</div>
            </div>
            <div className="stat">
                <div className="stat-title">Free Tools</div>
                <div className="stat-value text-success">{stats.freeTools}</div>
            </div>
            <div className="stat">
                <div className="stat-title">Recommended</div>
                <div className="stat-value text-warning">{stats.recommendedTools}</div>
            </div>
        </div>
    );
}
