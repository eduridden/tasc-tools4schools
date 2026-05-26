
import { useMemo } from 'react';

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }
  return null;
}

export function YouTubeEmbed({ videoUrl }: { videoUrl: string }) {
  const videoId = useMemo(() => extractVideoId(videoUrl), [videoUrl]);

  if (!videoId) return null;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
        loading="lazy"
      />
    </div>
  );
}
